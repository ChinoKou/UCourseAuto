import type { Site } from "@/schema/domain/site";
import type { UserConfig, UserIdentity } from "@/schema/domain/config";
import {
  errorFromFailure,
  errorFromMessage,
  failed,
  type OperationResult,
  type SignInPorts,
} from "@/usecases/ports";

/**
 * 登录、恢复会话与修改凭据: 平台调用经端口注入, 结果携带写入配置所需的全部字段。
 * 界面在成功后写入配置, 失败时本地账号资料保持不变。
 */

export interface SignedInAccount {
  siteRef: string;
  username: string;
  password: string;
  token: string;
  identity: UserIdentity;
}

export interface CredentialInput {
  username: string;
  nextSite: Site;
  nextPassword: string;
}

const identityOf = (response: { name: string; headimage?: string | null }): UserIdentity => ({
  name: response.name,
  headimage: response.headimage ?? null,
});

/** 登录失败转错误详情: 平台拒绝与传输失败给出不同说明 */
const loginFailure = (outcome: { status: "rejected"; code: number; message: string } | { status: "failed"; failure: Parameters<typeof errorFromFailure>[1] }) =>
  outcome.status === "rejected"
    ? errorFromMessage("登录没有完成", `${outcome.code} ${outcome.message}`)
    : errorFromFailure("登录没有完成", outcome.failure);

/** 构造账号结果 */
const signedInAccount = (
  siteRef: string,
  username: string,
  password: string,
  token: string,
  response: { name: string; headimage?: string | null },
): SignedInAccount => ({
  siteRef,
  username,
  password,
  token,
  identity: identityOf(response),
});

/**
 * 添加账号: 凭据登录成功后返回站点引用、凭据、令牌与账号资料。
 * 失败详情携带平台错误码与文案, 供表单直接展示。
 */
export async function addAccountWithLogin(
  ports: SignInPorts,
  site: Site,
  username: string,
  password: string,
): Promise<OperationResult<SignedInAccount>> {
  const outcome = await ports.login(site, username, password);
  if (outcome.status !== "success") {
    return failed(loginFailure(outcome));
  }
  return {
    status: "success",
    data: signedInAccount(
      site.ref,
      username,
      password,
      outcome.response.authorization,
      outcome.response,
    ),
  };
}

/**
 * 恢复会话: 存量令牌有效时直接复用, 复用后补拉账号资料(拉取失败保留存储资料);
 * 令牌无效时以凭据登录, 登录成功后再复验一次令牌。
 */
export async function restoreSession(
  ports: SignInPorts,
  stored: UserConfig,
  site: Site,
): Promise<OperationResult<SignedInAccount>> {
  if (stored.token !== "abc") {
    const validation = await ports.validateToken(site, stored.token);
    if (validation.ok && validation.data) {
      const profile = await ports.fetchCurrentUser(site, stored.token);
      const identity = profile.ok
        ? identityOf(profile.data)
        : { name: stored.name, headimage: stored.headimage };
      return {
        status: "success",
        data: {
          siteRef: site.ref,
          username: stored.username,
          password: stored.password,
          token: stored.token,
          identity,
        },
      };
    }
  }

  const outcome = await ports.login(site, stored.username, stored.password);
  if (outcome.status !== "success") {
    return failed(loginFailure(outcome));
  }

  const token = outcome.response.authorization;
  const recheck = await ports.validateToken(site, token);
  if (!recheck.ok || !recheck.data) {
    return failed(errorFromMessage("登录没有完成", "登录后令牌复验失败，请稍后重试。"));
  }

  return {
    status: "success",
    data: signedInAccount(site.ref, stored.username, stored.password, token, outcome.response),
  };
}

/**
 * 修改凭据: 以新的站点与密码登录并复验, 成功返回新令牌与账号资料。
 * 写入配置由界面在成功后执行, 保存过程中账号资料不会出现空值。
 */
export async function updateCredential(
  ports: SignInPorts,
  input: CredentialInput,
): Promise<OperationResult<SignedInAccount>> {
  const outcome = await ports.login(input.nextSite, input.username, input.nextPassword);
  if (outcome.status !== "success") {
    return failed(loginFailure(outcome));
  }

  const token = outcome.response.authorization;
  const recheck = await ports.validateToken(input.nextSite, token);
  if (!recheck.ok || !recheck.data) {
    return failed(errorFromMessage("账号修改没有完成", "新凭据登录后令牌复验失败。"));
  }

  return {
    status: "success",
    data: signedInAccount(
      input.nextSite.ref,
      input.username,
      input.nextPassword,
      token,
      outcome.response,
    ),
  };
}
