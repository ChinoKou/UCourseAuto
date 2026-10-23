from base64 import b64decode, b64encode

from Crypto.Cipher import DES
from Crypto.Util import Padding


def sync_text_encrypt(text: str) -> str:
    """sync接口文本加密"""

    # 初始化明文与密钥
    key = b"12345678"  # 前端逆向分析后得到
    data = text.encode("utf-8")

    # 创建 DES 加密对象
    cipher = DES.new(key, DES.MODE_ECB)

    # 填充数据并加密
    padded_data = Padding.pad(data, DES.block_size)
    encrypted_data = cipher.encrypt(padded_data)

    # Base64 编码
    encoded_data = b64encode(encrypted_data)
    encoded_text = encoded_data.decode("utf-8")

    return encoded_text


def sync_text_decrypt(text: str) -> str:
    """sync接口文本解密"""

    # 初始化密文与密钥
    key = b"12345678"
    data = b64decode(text.encode("utf-8"))

    # 创建 DES 解密对象
    cipher = DES.new(key, DES.MODE_ECB)

    # 解密数据并去除填充
    decrypted_data = cipher.decrypt(data)
    unpadded_data = Padding.unpad(decrypted_data, DES.block_size)

    # 解码数据
    decoded_text = unpadded_data.decode("utf-8")

    return decoded_text
