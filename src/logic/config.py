import json
import os
from base64 import b64decode
from collections.abc import Callable
from traceback import format_exc

import machineid
import yaml
from Crypto.Cipher import AES
from Crypto.Hash import HMAC, SHA256
from Crypto.Util.Padding import unpad
from loguru import logger

from src.schema import ConfigModel

CONFIG_DIR = "ucourse_data"
"""运行时数据目录"""

CONFIG_NAME = "ucourse_config.json"
"""配置文件名"""

CONFIG_PATH = os.path.join(CONFIG_DIR, CONFIG_NAME)
"""配置文件路径"""

LEGACY_CONFIG_NAME = "ucourse_config.yaml"
"""旧版配置文件名(位于项目根目录), 供配置迁移读取"""

CONFIG_VERSION = 1
"""当前配置版本号"""

ConfigDict = dict[str, object]
"""配置迁移过程中的中间数据结构"""


def _config_text_decrypt(text: str) -> str:
    """旧版配置文本解密 (AES-CBC + HMAC-SHA256, 密钥来自 machineid, 仅迁移使用)"""

    # 初始化密文和密钥
    data = text.encode("utf-8")
    machine_id = machineid.id()
    client_uuid_bytes = machine_id.replace("-", "").encode("utf-8")
    secret_key = client_uuid_bytes[:16]
    hmac_key = client_uuid_bytes[16:]

    # 解码密文
    data = b64decode(data)
    iv = data[: AES.block_size]
    ciphertext = data[AES.block_size : -32]
    received_hmac = data[-32:]

    # 校验 HMAC
    hmac = HMAC.new(hmac_key, digestmod=SHA256)
    hmac.update(iv + ciphertext)
    hmac.verify(received_hmac)

    # 解密
    cipher = AES.new(secret_key, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(ciphertext)
    decrypted_data = unpad(decrypted, AES.block_size)
    decrypted_text = decrypted_data.decode("utf-8")
    return decrypted_text


def _migrate_to_1(config_dict: ConfigDict) -> ConfigDict:
    """迁移升级钩子: v0(无版本号的旧版配置) -> v1

    旧版配置结构与新版本完全兼容, 新增字段由模型默认值补齐, 无需字段变换。
    旧版根目录 yaml 配置的读取与解密由 _read_legacy_config_dict 承担。
    """
    logger.info("配置迁移: v0 -> v1")
    return config_dict


MIGRATIONS: dict[int, Callable[[ConfigDict], ConfigDict]] = {
    1: _migrate_to_1,
}
"""迁移升级钩子注册表, 键为目标版本号"""


def _apply_migrations(config_dict: ConfigDict) -> ConfigDict:
    """按当前版本号依序执行迁移升级钩子, 直至最新版本"""

    # 无版本号视为 v0
    version = config_dict.get("config_version", 0)

    # 版本号类型异常时就地抛出, 由调用方清理重建
    if not isinstance(version, int):
        raise TypeError(f"配置版本号类型错误: {type(version).__name__}")

    for target_version in range(version + 1, CONFIG_VERSION + 1):
        hook = MIGRATIONS[target_version]
        config_dict = hook(config_dict)
        config_dict["config_version"] = target_version

    return config_dict


def _read_legacy_config_dict() -> ConfigDict | None:
    """读取旧版根目录 yaml 配置, 返回迁移前数据; 旧配置不存在或为空时返回 None"""
    if not os.path.exists(LEGACY_CONFIG_NAME):
        return None

    with open(LEGACY_CONFIG_NAME, "r", encoding="utf-8") as f:
        file_content = f.read().strip()

    # 空文件视为无旧配置
    if not file_content:
        return None

    config_dict = yaml.safe_load(file_content)

    # 旧版加密配置
    if isinstance(config_dict, dict) and "encrypted_config" in config_dict:
        decrypted_text = _config_text_decrypt(config_dict["encrypted_config"])
        config_dict = yaml.safe_load(decrypted_text)

    if not isinstance(config_dict, dict):
        raise TypeError("旧版配置文件结构错误")

    return config_dict


class Config(ConfigModel):
    """配置信息类"""

    def save(self, config_path: str = CONFIG_PATH) -> None:
        """保存配置信息到 JSON 文件"""

        try:
            # 确保数据目录存在
            os.makedirs(os.path.dirname(config_path), exist_ok=True)

            # 明文保存 (注意: 密码等敏感信息以明文形式保存在本地)
            config_dict = self.model_dump()
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config_dict, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"{format_exc()}\n保存配置文件失败: {e}")

    def reload(self) -> bool:
        """从 JSON 文件重新加载配置信息"""

        try:
            # 读取配置文件
            new_config = self.load()

            # 赋值
            for field_name in Config.model_fields:
                setattr(self, field_name, getattr(new_config, field_name))

            return True

        except Exception as e:
            logger.error(f"{format_exc()}\n加载配置文件失败: {e}")
            return False

    @classmethod
    def load(cls, config_path: str = CONFIG_PATH) -> "Config":
        """从 JSON 文件加载配置信息, 旧版配置自动迁移升级"""

        try:
            # 新配置不存在时, 尝试从旧版根目录配置迁移
            if not os.path.exists(config_path):
                legacy_config_dict = _read_legacy_config_dict()
                if legacy_config_dict is not None:
                    return cls._migrate_legacy_config(legacy_config_dict, config_path)

                return cls.create_default_config(config_path)

            with open(config_path, "r", encoding="utf-8") as f:
                file_content = f.read().strip()

                # 空文件, 创建默认配置文件
                if not file_content:
                    return cls.create_default_config(config_path)

                config_dict: ConfigDict = json.loads(file_content)

                # 执行迁移升级钩子
                original_version = config_dict.get("config_version", 0)
                migrated_dict = _apply_migrations(config_dict)

                # 迁移发生过时立即持久化新版本
                if migrated_dict.get("config_version") != original_version:
                    migrated_config = cls.model_validate(migrated_dict)
                    migrated_config.save(config_path)
                    return migrated_config

                return cls.model_validate(config_dict)

        except Exception as e:
            logger.error(f"{format_exc()}\n加载配置文件失败, 重新生成配置文件: {e}")

            # 清理新旧配置文件, 避免损坏配置反复触发迁移失败
            for path in (config_path, LEGACY_CONFIG_NAME):
                if os.path.exists(path):
                    os.remove(path)

            return cls.load(config_path)

    @classmethod
    def _migrate_legacy_config(
        cls, config_dict: ConfigDict, config_path: str
    ) -> "Config":
        """将旧版配置迁移升级为新版配置并保存"""
        logger.info("检测到旧版配置文件, 正在迁移至新版本...")

        # 执行迁移升级钩子并校验
        config_dict = _apply_migrations(config_dict)
        config = cls.model_validate(config_dict)

        # 保存新配置, 写入失败时保留旧文件以便重试
        config.save(config_path)
        if not os.path.exists(config_path):
            raise RuntimeError("迁移后配置文件写入失败")

        # 迁移完成后移除旧配置文件
        os.remove(LEGACY_CONFIG_NAME)
        logger.success("配置迁移完成, 旧配置文件已移除")
        return config

    @classmethod
    def create_default_config(cls, config_path: str = CONFIG_PATH) -> "Config":
        """创建默认配置信息"""

        default_config = cls()
        default_config.save(config_path)
        return default_config
