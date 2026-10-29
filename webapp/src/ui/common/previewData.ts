import type { ModelCourse } from "@/schema/domain/course";
import type { UserConfig } from "@/schema/domain/config";
import { DEFAULT_SITE_REF } from "@/schema/domain/site";

/**
 * 未登录访客预览用的完整五层课件树样本数据
 * 包含课程、教材、章、节、页面五级真实颗粒度，供工作台与课件库真实呈现
 */
export const PREVIEW_COURSES: ReadonlyArray<ModelCourse> = [
  {
    course_id: 101,
    course_name: "大学计算机基础与前沿应用",
    class_id: 201,
    class_user_id: 301,
    textbooks: [
      {
        textbook_id: 1001,
        textbook_name: "第一分册：计算机系统与网络通信",
        status: 1,
        limit: 0,
        chapters: [
          {
            chapter_id: 2001,
            chapter_name: "第 1 章 现代计算机体系架构概论",
            sections: [
              {
                section_id: 3001,
                section_name: "1.1 计算原理与冯·诺依曼架构演进",
                pages: [
                  {
                    page_id: 4001,
                    page_relation_id: 4001,
                    page_name: "计算发展简史与前导知识",
                    page_content_type: 12,
                    is_complete: true,
                    elements: [{ kind: "content" }],
                  },
                  {
                    page_id: 4002,
                    page_relation_id: 4002,
                    page_name: "现代处理器与指令集解析",
                    page_content_type: 6,
                    is_complete: true,
                    elements: [{ kind: "video", video_id: 5002, video_length: 420 }],
                  },
                  {
                    page_id: 4003,
                    page_relation_id: 4003,
                    page_name: "第 1 节 知识巩固与单元测试",
                    page_content_type: 7,
                    is_complete: false,
                    elements: [
                      {
                        kind: "question",
                        questions: [
                          {
                            question_id: 6001,
                            question_score: 10,
                            question_content: "冯·诺依曼架构的核心思想是？",
                            question_answer_list: ["存储程序与程序控制"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                section_id: 3002,
                section_name: "1.2 存储层次与高速缓存机制",
                pages: [
                  {
                    page_id: 4004,
                    page_relation_id: 4004,
                    page_name: "内存分页与虚拟地址映射",
                    page_content_type: 6,
                    is_complete: false,
                    elements: [{ kind: "video", video_id: 5004, video_length: 300 }],
                  },
                  {
                    page_id: 4005,
                    page_relation_id: 4005,
                    page_name: "存储器性能测评参考资料",
                    page_content_type: 5,
                    is_complete: false,
                    elements: [{ kind: "document" }],
                  },
                ],
              },
            ],
          },
          {
            chapter_id: 2002,
            chapter_name: "第 2 章 操作系统调度与并发控制",
            sections: [
              {
                section_id: 3003,
                section_name: "2.1 进程管理与调度模型",
                pages: [
                  {
                    page_id: 4006,
                    page_relation_id: 4006,
                    page_name: "进程上下文切换与调度策略",
                    page_content_type: 6,
                    is_complete: false,
                    elements: [{ kind: "video", video_id: 5006, video_length: 360 }],
                  },
                  {
                    page_id: 4007,
                    page_relation_id: 4007,
                    page_name: "并发同步与锁机制实验指导",
                    page_content_type: 5,
                    is_complete: false,
                    elements: [{ kind: "document" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        textbook_id: 1002,
        textbook_name: "第二分册：算法设计与数据组织",
        status: 1,
        limit: 0,
        chapters: [
          {
            chapter_id: 2003,
            chapter_name: "第 3 章 树状数据结构与索引优化",
            sections: [
              {
                section_id: 3004,
                section_name: "3.1 二叉查找树与平衡因子分析",
                pages: [
                  {
                    page_id: 4008,
                    page_relation_id: 4008,
                    page_name: "平衡树构建与旋转演练",
                    page_content_type: 6,
                    is_complete: false,
                    elements: [{ kind: "video", video_id: 5008, video_length: 280 }],
                  },
                  {
                    page_id: 4009,
                    page_relation_id: 4009,
                    page_name: "第 3 节 算法能力自测",
                    page_content_type: 7,
                    is_complete: false,
                    elements: [
                      {
                        kind: "question",
                        questions: [
                          {
                            question_id: 6002,
                            question_score: 10,
                            question_content: "AVL树的平衡因子绝对值不能超过？",
                            question_answer_list: ["1"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

/** 未登录时用于提供真实界面的演示账号配置 */
export const PREVIEW_USER: UserConfig = {
  site: DEFAULT_SITE_REF,
  username: "preview_guest",
  password: "",
  token: "preview_token",
  courses: [...PREVIEW_COURSES],
  name: "访客预览",
  headimage: null,
};
