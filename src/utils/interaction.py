from questionary import Question


async def answer(question: Question):
    """获取用户输入"""

    answer = await question.ask_async()
    if not answer:
        raise KeyboardInterrupt

    return answer
