from src.schema.api_request import SyncStudyRecordAPIRequest
from src.schema.api_response import (
    ChapterInfoAPIResponse,
    CourseAPIUserInfoAPIResponse,
    CourseListAPIResponse,
    LoginAPIUserInfoResponse,
    QuestionAnswerAPIResponse,
    StudyRecordAPIResponse,
    TextbookInfoAPIResponse,
    TextbookListAPIResponse,
)
from src.schema.common import APIUrl, UserAPI
from src.schema.config import ConfigModel, UserConfig
from src.schema.course import ModelCourse, ModelTextbook
from src.schema.courseware import (
    CoursewareChapter,
    CoursewarePage,
    CoursewareSection,
    ElementContent,
    ElementDocumen,
    ElementQuestion,
    ElementVideo,
)

__all__ = [
    "APIUrl",
    "ChapterInfoAPIResponse",
    "ConfigModel",
    "CourseAPIUserInfoAPIResponse",
    "CourseListAPIResponse",
    "CoursewareChapter",
    "CoursewarePage",
    "CoursewareSection",
    "ElementContent",
    "ElementDocumen",
    "ElementQuestion",
    "ElementVideo",
    "LoginAPIUserInfoResponse",
    "ModelCourse",
    "ModelTextbook",
    "QuestionAnswerAPIResponse",
    "StudyRecordAPIResponse",
    "SyncStudyRecordAPIRequest",
    "TextbookInfoAPIResponse",
    "TextbookListAPIResponse",
    "UserAPI",
    "UserConfig",
]
