import asyncio

import pytest

from src.logic.version_manager import VersionManager


@pytest.fixture
def version_manager():
    return VersionManager()


def set_latest_release(monkeypatch, version_manager, tag):
    """把获取最新版本信息替换为固定返回, 不发起网络请求"""

    async def fake_get_latest_info(use_proxy=False):
        return (tag, "发布信息")

    monkeypatch.setattr(version_manager, "get_latest_info", fake_get_latest_info)


def test_check_version_detects_higher_patch_number(monkeypatch, version_manager):
    """跨位数版本号按数值比较: v1.1.9 能感知 v1.1.10 为新版本

    字符串字典序比较会得出 v1.1.9 不小于 v1.1.10 的错误结果, 导致旧版本
    用户收不到更新提示。
    """
    version_manager.tag = "v1.1.9"
    set_latest_release(monkeypatch, version_manager, "v1.1.10")

    assert asyncio.run(version_manager.check_version()) is False


def test_check_version_same_version(monkeypatch, version_manager):
    """当前版本与最新版本一致时不提示"""
    version_manager.tag = "v1.1.10"
    set_latest_release(monkeypatch, version_manager, "v1.1.10")

    assert asyncio.run(version_manager.check_version()) is True


def test_check_version_older_latest_release(monkeypatch, version_manager):
    """最新版本旧于当前版本时不提示"""
    version_manager.tag = "v1.1.10"
    set_latest_release(monkeypatch, version_manager, "v1.1.9")

    assert asyncio.run(version_manager.check_version()) is True


def test_check_version_minor_bump(monkeypatch, version_manager):
    """次版本号提升时提示新版本"""
    version_manager.tag = "v1.1.10"
    set_latest_release(monkeypatch, version_manager, "v1.2.0")

    assert asyncio.run(version_manager.check_version()) is False
