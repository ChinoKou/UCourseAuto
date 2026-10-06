# UCourseAuto

[English](README.en.md) | 简体中文

## UCourseAuto 是什么？

UCourseAuto 是一个用于自动完成 优学院 平台课件的命令行自动化工具。

## 功能特性

- 视频观看（模拟观看进度）
- 答题（自动查询答案）
- 文档阅读模拟
- 纯文本页面完成
- 自定义学习时长
- 多用户支持
- 课件配置修改

## 支持站点

- 优学院主站 https://www.ulearning.cn
- 东莞理工学院 https://lms.dgut.edu.cn

## 使用方法

- 从 [Releases 页面](https://github.com/ChinoKou/UCourseAuto/releases/latest) 下载最新的二进制文件，直接运行
- 克隆本仓库，使用 Python 3.12+ 直接运行

## 工作原理

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Main as CLI Main
    participant CM as CourseManager
    participant DM as DataManager
    participant API as CourseAPI
    participant Server as ULearning Server

    User->>Main: Select "Start Courseware"
    Main->>CM: Invoke __start_course_ware()
    activate CM
    
    Note over CM: Load UserConfig<br/>Iterate: Course -> Textbook -> Chapter -> Section

    loop Every "Section"
        CM->>API: initialize_section(section_id)
        activate API
        API->>Server: GET /studyrecord/initialize/{id}
        Server-->>API: Return timestamp (studyStartTime)
        API-->>CM: Return timestamp
        deactivate API

        loop Every "Page" in Section
            alt Page Type is Video
                loop Every Video Element
                    CM->>API: watch_video_behavior(video_id...)
                    API->>Server: POST /behavior/watchVideo
                    Note right of API: Send video heartbeat/anti-cheat beacon
                end
            end
            Note over CM: Simulate study duration<br/>(Sleep / Random Delay)
        end

        CM->>DM: build_sync_study_record_request()
        activate DM
        Note right of DM: 1. Calculate total study time<br/>2. Generate video progress data<br/>3. Fill in correct answers<br/>4. Randomize operation times
        DM-->>CM: Return SyncStudyRecordAPIRequest object
        deactivate DM

        CM->>API: sync_study_record(request_data)
        activate API
        Note right of API: Call utils.sync_text_encrypt<br/>Encrypt payload (DES + Base64)
        API->>Server: POST /yws/api/personal/sync
        Server-->>API: Return Status "1" (Success)
        API-->>CM: Return True
        deactivate API

        Note over CM: Cooling down (Sleep Time)
    end

    CM-->>Main: All Tasks Completed
    Main-->>User: Show Success Message
    deactivate CM
```

## 使用条款

使用本工具即表示你已知晓在 优学院 平台上使用自动化工具的相关风险，并接受以下条款：

- 作者不保证使用本工具不会被 优学院 平台检测到
- 因使用本工具产生的一切后果（包括但不限于纪律处分）均由用户自行承担
