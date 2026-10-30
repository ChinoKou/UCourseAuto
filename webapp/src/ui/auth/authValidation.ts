import type { Site } from "@/schema/domain/site";

/** 判定指定站点是否属于东莞理工学院 */
export const isDgutSite = (site: Site | undefined): boolean => {
  if (site === undefined) {
    return false;
  }
  return (
    site.ref === "dgut" ||
    site.ua_api.includes("dgut.edu.cn") ||
    site.course_api.includes("dgut.edu.cn")
  );
};

export interface UsernameValidationResult {
  error: string | null;
  warning: string | null;
}

/** 解析用户名的校验错误与警示信息 */
export const resolveUsernameValidation = (
  username: string,
  touched: boolean,
  isDgut: boolean,
): UsernameValidationResult => {
  const trimmed = username.trim();
  if (!touched) {
    return { error: null, warning: null };
  }
  if (trimmed.length === 0) {
    return { error: "请输入用户名", warning: null };
  }
  if (isDgut && !trimmed.toLowerCase().startsWith("dgut")) {
    return {
      error: null,
      warning: "东莞理工学院用户名以 dgut 开头（示例 dgut2099xxxxx）",
    };
  }
  return { error: null, warning: null };
};
