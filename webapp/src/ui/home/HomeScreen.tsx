import {
  IconArrowRight,
  IconBooks,
  IconChecklist,
  IconClock,
  IconDeviceDesktop,
  IconHelpCircle,
  IconHierarchy2,
  IconLayoutDashboard,
  IconPlayerPlay,
  IconServer,
  IconSparkles,
  IconVideo,
} from "@tabler/icons-react";
import { motion } from "motion/react";

import { Button } from "@/ui/common/Button";
import { staggerContainer, staggerItem } from "@/ui/motion/presets";

export interface HomeScreenProps {
  onGoDashboard: () => void;
  onGoLibrary: () => void;
}

/**
 * 首页 Tab: 项目介绍、核心功能说明与工作台入口
 */
export function HomeScreen({ onGoDashboard, onGoLibrary }: HomeScreenProps) {
  return (
    <div className="uc-page uc-home-intro">
      <motion.div
        className="uc-intro-container"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* 顶部 Hero 区域 */}
        <motion.section className="uc-intro-hero" variants={staggerItem}>
          <div className="uc-intro-hero__badge">
            <IconSparkles size={14} />
            <span>纯静态前端应用 · 浏览器直连平台 · 开源项目</span>
          </div>

          <h1 className="uc-intro-hero__title">
            <span>优学院</span> 课件自动化学习工具
          </h1>

          <p className="uc-intro-hero__desc">
            UCourseAuto 网页版部署于 Cloudflare Pages，为纯静态前端工具。所有网络请求由浏览器直接发送至
            优学院 平台，无需配置本地运行环境，即可自动化完成视频观看、题目解答与文档阅读。
          </p>

          <div className="uc-intro-hero__actions">
            <Button
              variant="primary"
              size="lg"
              icon={<IconLayoutDashboard size={18} />}
              onClick={onGoDashboard}
            >
              <span>进入工作台</span>
              <IconArrowRight size={16} />
            </Button>

            <Button
              variant="secondary"
              size="lg"
              icon={<IconBooks size={18} />}
              onClick={onGoLibrary}
            >
              <span>查看课件库</span>
            </Button>
          </div>
        </motion.section>

        {/* 核心功能概览 */}
        <motion.section className="uc-intro-pillars" variants={staggerItem}>
          <div className="uc-intro-pillar-card">
            <div className="uc-intro-pillar-card__icon">
              <IconVideo size={22} />
            </div>
            <div className="uc-intro-pillar-card__content">
              <h3>视频观看与心跳</h3>
              <p>自动模拟视频播放进度并发送心跳信标，支持针对视频配置独立时长与浮动范围。</p>
            </div>
          </div>

          <div className="uc-intro-pillar-card">
            <div className="uc-intro-pillar-card__icon">
              <IconHelpCircle size={22} />
            </div>
            <div className="uc-intro-pillar-card__content">
              <h3>题目解答与提交</h3>
              <p>自动查询随堂测验的参考答案并完成提交，支持单选、多选与判断题目类型。</p>
            </div>
          </div>

          <div className="uc-intro-pillar-card">
            <div className="uc-intro-pillar-card__icon">
              <IconHierarchy2 size={22} />
            </div>
            <div className="uc-intro-pillar-card__content">
              <h3>五层课件树管理</h3>
              <p>按课程、教材、章、节、页面五级呈现结构，支持多选、反选、筛选以及行级删除。</p>
            </div>
          </div>

          <div className="uc-intro-pillar-card">
            <div className="uc-intro-pillar-card__icon">
              <IconClock size={22} />
            </div>
            <div className="uc-intro-pillar-card__content">
              <h3>时长与冷却调节</h3>
              <p>支持按课件类别调整学习停留时长，并在每个小节推进完成后执行设定的等待冷却。</p>
            </div>
          </div>
        </motion.section>

        {/* 工具特性与使用机制 */}
        <motion.section className="uc-intro-features" variants={staggerItem}>
          <div className="uc-intro-section-head">
            <span className="uc-eyebrow">
              <IconChecklist size={14} />
              <span>系统运行机制</span>
            </span>
            <h2>工具特性与实现方式</h2>
            <p>基于纯静态网页架构设计，所有数据和运行逻辑均由当前浏览器执行。</p>
          </div>

          <div className="uc-intro-grid">
            <div className="uc-intro-card">
              <div className="uc-intro-card__icon uc-intro-card__icon--accent">
                <IconDeviceDesktop size={22} />
              </div>
              <h3>纯前端无服务端架构</h3>
              <p>
                无需配置 Python 或本地开发环境。应用由浏览器直接发起 HTTP 请求与 优学院
                平台交互，无任何中转代理服务器参与。
              </p>
            </div>

            <div className="uc-intro-card">
              <div className="uc-intro-card__icon uc-intro-card__icon--warm">
                <IconServer size={22} />
              </div>
              <h3>本地数据与多账号管理</h3>
              <p>
                账号列表与配置数据保存在浏览器的 localStorage 中，支持保存多个账号并在工作台随时快捷切换。
              </p>
            </div>

            <div className="uc-intro-card">
              <div className="uc-intro-card__icon uc-intro-card__icon--success">
                <IconPlayerPlay size={22} />
              </div>
              <h3>工作台集中控制与屏幕常亮</h3>
              <p>
                参数调整与控制台处于同一界面，运行中展示阶段进度与统计信息；通过浏览器唤醒锁定申请屏幕常亮，防止后台休眠。
              </p>
            </div>
          </div>
        </motion.section>

        {/* 使用步骤 */}
        <motion.section className="uc-intro-steps" variants={staggerItem}>
          <div className="uc-intro-section-head">
            <span className="uc-eyebrow">
              <IconPlayerPlay size={14} />
              <span>使用步骤</span>
            </span>
            <h2>三步开始使用</h2>
          </div>

          <div className="uc-intro-steps__list">
            <div className="uc-intro-step-item">
              <div className="uc-intro-step-item__number">01</div>
              <h3>登录平台账号</h3>
              <p>选择登录站点，输入账号与密码完成登录，凭证保存在当前浏览器中。</p>
            </div>

            <div className="uc-intro-step-item">
              <div className="uc-intro-step-item__number">02</div>
              <h3>同步并勾选课件</h3>
              <p>在课件库中通过配置向导拉取课程结构，勾选本次需要推进学习的章节与小节。</p>
            </div>

            <div className="uc-intro-step-item">
              <div className="uc-intro-step-item__number">03</div>
              <h3>在工作台启动任务</h3>
              <p>在工作台微调所需时长与小节冷却参数，点击启动按钮开始自动化执行任务。</p>
            </div>
          </div>
        </motion.section>

        {/* 底部引导横幅 */}
        <motion.section className="uc-intro-cta" variants={staggerItem}>
          <div className="uc-intro-cta__inner">
            <div className="uc-intro-cta__content">
              <h2>进入工作台开始使用</h2>
              <p>打开工作台卡片，连接账号并开始管理您的课程学习任务。</p>
            </div>
            <div className="uc-intro-cta__actions">
              <Button
                variant="primary"
                size="lg"
                icon={<IconLayoutDashboard size={18} />}
                onClick={onGoDashboard}
              >
                <span>进入工作台</span>
                <IconArrowRight size={16} />
              </Button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
