import type { UserConfig } from "@/schema/domain/config";

/** 编辑账号弹窗的表单初值 */
export interface EditAccountFormState {
  siteRef: string;
  password: string;
}

/** 由当前账号构造表单初值, 每次挂载都按当前账号重新计算 */
export const initialEditForm = (user: UserConfig): EditAccountFormState => ({
  siteRef: user.site,
  password: user.password,
});
