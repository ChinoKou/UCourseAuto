import os
from base64 import b64encode

import machineid
import pytest
import yaml
from Crypto.Cipher import AES
from Crypto.Hash import HMAC, SHA256
from Crypto.Util.Padding import pad

import src.logic.config as config_module

SAMPLE_CONFIG = {
    "debug": False,
    "active_user": "tester",
    "users": {
        "u1": {"site": "ulearning", "username": "u1", "password": "p1"},
        "u2": {"site": "dgut", "username": "u2", "password": "p2"},
    },
}


def write_encrypted_legacy(path) -> None:
    """按旧版逻辑加密构造一份旧版根目录配置文件"""
    data = yaml.dump(SAMPLE_CONFIG, allow_unicode=True).encode("utf-8")
    key_bytes = machineid.id().replace("-", "").encode("utf-8")
    iv = os.urandom(AES.block_size)
    cipher = AES.new(key_bytes[:16], AES.MODE_CBC, iv)
    ciphertext = cipher.encrypt(pad(data, AES.block_size))
    hmac = HMAC.new(key_bytes[16:], digestmod=SHA256)
    hmac.update(iv + ciphertext)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(
            {"encrypted_config": b64encode(iv + ciphertext + hmac.digest()).decode()},
            f,
        )


@pytest.fixture
def legacy_config_path(tmp_path, monkeypatch):
    """构造加密旧配置, 并把迁移入口指向临时路径"""
    legacy_path = tmp_path / "ucourse_config.yaml"
    write_encrypted_legacy(legacy_path)
    monkeypatch.setattr(config_module, "LEGACY_CONFIG_NAME", str(legacy_path))
    return legacy_path


def test_migration_write_failure_keeps_legacy(
    tmp_path, monkeypatch, legacy_config_path
):
    """迁移写盘失败时保留旧配置文件, 本次运行使用内存配置

    源自迁移写入失败会被异常清理放大为旧配置静默丢失的缺陷,
    写盘失败不应让用户重新登录。
    """
    json_path = tmp_path / "ucourse_config.json"
    monkeypatch.setattr(config_module.Config, "save", lambda self, path: None)

    config = config_module.Config.load(str(json_path))

    assert legacy_config_path.exists()
    assert len(config.users) == 2
    assert config.active_user == "tester"


def test_migration_failure_then_retry_succeeds(
    tmp_path, monkeypatch, legacy_config_path
):
    """写盘失败后下次启动重试迁移, 成功落盘并移除旧文件"""
    json_path = tmp_path / "ucourse_config.json"
    real_save = config_module.Config.save
    save_calls = {"count": 0}

    def failing_once_save(self, path):
        # 首次调用模拟写盘失败, 其后走真实保存
        if save_calls["count"] == 0:
            save_calls["count"] += 1
            return None
        return real_save(self, path)

    monkeypatch.setattr(config_module.Config, "save", failing_once_save)

    config_module.Config.load(str(json_path))
    assert legacy_config_path.exists()

    config = config_module.Config.load(str(json_path))
    assert json_path.exists()
    assert not legacy_config_path.exists()
    assert config.active_user == "tester"
