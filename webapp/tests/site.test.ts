import { describe, expect, it } from "vitest";

import {
  allSites,
  BUILTIN_SITES,
  customSiteToSite,
  DEFAULT_SITE_REF,
  findSite,
} from "@/schema/domain/site";

describe("站点领域定义与默认选择", () => {
  it("默认登录站点为东莞理工学院 (dgut)", () => {
    expect(DEFAULT_SITE_REF).toBe("dgut");
    expect(BUILTIN_SITES[1]?.ref).toBe(DEFAULT_SITE_REF);
    expect(BUILTIN_SITES[1]?.name).toBe("东莞理工学院");
  });

  it("findSite 与 allSites 能正确查找内置与自定义站点", () => {
    const defaultSite = findSite(DEFAULT_SITE_REF, []);
    expect(defaultSite?.name).toBe("东莞理工学院");
    expect(defaultSite?.course_api).toBe("https://lms.dgut.edu.cn/courseapi");

    const custom = customSiteToSite({
      id: "cust1",
      name: "私有站点",
      course_api: "https://school.edu.cn/courseapi",
      ua_api: "https://school.edu.cn/uaapi",
    });
    const customList = [
      {
        id: "cust1",
        name: "私有站点",
        course_api: "https://school.edu.cn/courseapi",
        ua_api: "https://school.edu.cn/uaapi",
      },
    ];
    const sites = allSites(customList);
    expect(sites).toHaveLength(3);
    expect(findSite(custom.ref, customList)?.name).toBe("私有站点");
  });
});
