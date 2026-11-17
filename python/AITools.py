from ddgs import DDGS
import sys
import io

def search_web(query: str):
    """Searches the internet for up-to-date information based on a given query. Returns snippets from the three most relevant results."""
    print(f"[TOOL] Performing an internet search: {query}")
    try:
        with DDGS() as ddgs:
            results = []
            search_stream = ddgs.text(query, max_results=3)
            for r in search_stream:
                results.append(r)

            if not results:
                return "Nothing was found."

            output = ""
            for r in results:
                output += f"Title: {r['title']}\nSnippet: {r['body']}\nURL: {r['href']}\n\n"
            return output
    except Exception as e:
        return f"[TOOL ERROR]: {e}"


def getweather(city):
    """Retrieves the current weather for a given city"""
    return f"It is currently +20°C and sunny in the city of {city}."


# def generate_image_with_stable_diffusion(prompt: str):
#     import ImageGenerator
#     """
#     Генерує зображення за текстовим описом за допомогою FLUX.
#     Args:
#         prompt: Опис того, що намалювати, враховуй, що FLUX не має контексту розмови, тож потребує детальних пояснень з нуля.
#         Дотримуйся стилю промптів для генерації зображень
#     """
#     print(f"\n[Система] Запускаємо генератор зображень для: {prompt}")
#     ImageGenerator.generateImage(prompt)
#     return "Картинку успішно згенеровано і збережено як output.png"

def execute_python_code(code: str) -> str:
    """
    Executes the passed Python code locally and returns whatever the code output to the console (via print).
    Use when the user needs to execute Python code to respond. DO NOT USE FOR MACHINE VISION.

    :param code: A string with pure Python code.
    :return: The result of the code execution is obtained via print or the error text.
    """
    # Створюємо буфер для перехоплення принтів
    output_buffer = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = output_buffer

    try:
        # Створюємо ізольоване середовище для змінних всередині exec
        local_vars = {}
        exec(code, {}, local_vars)

        # Повертаємо те, що код надрукував
        sys.stdout = old_stdout
        return output_buffer.getvalue() if output_buffer.getvalue() else "Код виконано успішно, але він нічого не вивів (використовуй print())."

    except Exception as e:
        # Якщо в коді ШІ була помилка, повертаємо її текст — модель прочитає її і виправить свій код!
        sys.stdout = old_stdout
        return f"Помилка під час виконання коду: {type(e).__name__}: {e}"


from datetime import datetime

def get_current_timestamp() -> str:
    """Returns the current date and time as a formatted string."""
    return datetime.now().strftime("%d-%m-%Y %H:%M:%S")