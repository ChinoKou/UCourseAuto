import CryptoJS from "crypto-js/core";
import "crypto-js/enc-utf8";
import "crypto-js/enc-base64";
import "crypto-js/tripledes";
import "crypto-js/mode-ecb";
import "crypto-js/pad-pkcs7";

// 前端逆向分析得到的固定密钥(公开常量, 与 cli 一致)
const KEY = CryptoJS.enc.Utf8.parse("12345678");

/** sync 接口文本加密: DES / ECB / PKCS7(块 8 字节), 输出 Base64 */
export function syncTextEncrypt(text: string): string {
  const encrypted = CryptoJS.DES.encrypt(text, KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

/** sync 接口文本解密: Base64 密文还原为明文 */
export function syncTextDecrypt(base64Text: string): string {
  const decrypted = CryptoJS.DES.decrypt(
    CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(base64Text),
    }),
    KEY,
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
}
