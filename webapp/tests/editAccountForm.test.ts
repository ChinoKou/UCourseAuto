import { describe, expect, it } from "vitest";

import { initialEditForm } from "@/ui/account/editAccountForm";
import type { UserConfig } from "@/schema/domain/config";

const account = (site: string, password: string): UserConfig => ({
  site,
  username: "202501001",
  password,
  token: "tok",
  courses: [],
  name: "",
  headimage: null,
});

describe("编辑账号表单初值", () => {
  it("按当前账号的站点与密码构造表单", () => {
    expect(initialEditForm(account("ulearning", "pw-a"))).toEqual({
      siteRef: "ulearning",
      password: "pw-a",
    });
  });

  it("账号变化后重新构造, 不复用上一个账号的值", () => {
    const first = initialEditForm(account("ulearning", "pw-a"));
    const second = initialEditForm(account("dgut", "pw-b"));

    expect(second).toEqual({ siteRef: "dgut", password: "pw-b" });
    expect(second).not.toEqual(first);
  });
});
