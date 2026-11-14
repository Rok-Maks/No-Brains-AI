import datetime
import time
import ollama
from colorama import Fore
import threading
import AITools

history = []
response = {}
currentId = 0
message_db = {}

model_options = {
    "num_ctx": 8192,
    # "num_ctx": 2048 , # Загальний розмір контексту, скільки модель може пам'ятати
    "num_predict": -1, # Скільки токенів модель може використати на повідомлення (включаючи роздуми)
    "temperature": 0.7,
    # "seed": random.randint(1, 1000000),
    "top_k": 50, # Обрізає всю вибірку токенів до n найбільш ймовірних
    "top_p": 0.95, # Ймовірність, що моедль візьме найбільш ймовірний токен
}
model_tools = [
    # AITools.getweather,
    AITools.execute_python_code,
    AITools.search_web,
    AITools.get_current_timestamp
]

model :str = "instruct-abliterated" # 7.6B lobotomized, tools
# model = "gemma3:12b" # 12.2B Vision
# model = "qwen3.5:9b" # 9.7B Vision, Tools, Thinking
# model = "moondream" # 454M Vision (stupid)

capabilities = {
   "instruct-abliterated": ["Completion", "Tools", ],
   "gemma3:12b": ["Completion", "Vision", ],
   "qwen3.5:9b": ["Completion", "Vision", "Tools", "Thinking"],
   "moondream": ["Completion", "Vision", ],
}


def get_current_time():
    return datetime.datetime.now().strftime("Sent At: %A, %Y-%m-%d %H:%M:%S")

def decode_TXT(path):
    with open(path, "r", encoding="utf-8") as file:
        return file.read()

def formMessage(promptText, images = None, role = "user"):
    msg = {
        "role": role,
        "content": promptText or ""
    }
    if images and "Vision" in capabilities[model]:
        msg["images"] = images
    return msg



def set_settings(settings_data):
    global model
    global model_options
    model = settings_data["modelName"]
    model_options["num_ctx"] = float(settings_data["num_ctx"])
    model_options["num_predict"] = float(settings_data["num_predict"])
    model_options["temperature"] = float(settings_data["temperature"])
    model_options["top_k"] = float(settings_data["top_k"])
    model_options["top_p"] = float(settings_data["top_p"])

def show_loading(text):
    while loading:
        for dots in [".", "..", "..."]:
            if not loading:
                break
            #print(f"\r{text}{dots}".ljust(15), end="", flush=True)
            time.sleep(0.5)
    return

def clearHistory():
    global message_db
    global  currentId
    currentId = 0
    message_db = {}

def getHistory(lastMessageId):
    history = []
    id = lastMessageId
    while id in message_db.keys():
        history.append(message_db[id]['message'])
        id = message_db[id]['parentId']
        if not id and id != 0:
            break
        id = int(id)
    history.reverse()
    return  history


def print_history():
    for i,v in enumerate(history):
        v = v.copy()
        if 'images' in v.keys():
            v['images'] = 'image'
    print(history)

def editMessage(id, text, images, role="user", branch = False):
    global message_db
    global  currentId
    prompt_message = formMessage(text, images, role)
    newId = id
    if branch:
        newId = currentId
        currentId += 1
    message_db[newId] = {'message':prompt_message, 'parentId': message_db[id]['parentId']}
    return newId

def rerollMessage(id):
    global currentId
    originalMessage = message_db[id]

    response, userMessageId, aiMessageId, sys_msg_ids = simple_prompt(originalMessage['parentId'], 1)
    return response, aiMessageId

sys_msg_ids = []
def promptAI(promptText=None, images:list=None, tools = [], parentId = None):
    global loading
    global currentId
    global sys_msg_ids
    sys_msg_ids = []
    if not(promptText or images):
        print("No text or images", promptText, images)
        return
    prompt_message = formMessage(promptText, images)
    userMessageId = currentId
    currentId += 1
    message_db[userMessageId] = {'message': prompt_message, 'parentId': parentId}
    history = getHistory(userMessageId)

    text = f"{Fore.LIGHTBLACK_EX}"
    loading = True
    loader_thread = threading.Thread(target=show_loading, args=(text,), daemon=True)
    loader_thread.start()
    print("Loading...")
    response = ollama.chat(
        model=model,
        messages=history,
        tools= "Tools" in capabilities[model] and model_tools or None,
        options=model_options,
    )
    # if not "Tools" in capabilities[model]:

    loading = False
    #print("\r\033[K", end="", flush=True)  # Чистимо рядок від крапочок лоадера

    if response.message.tool_calls: # Tool call happened
        print("164 Response with tool call: ", response)
        return toolHandler(response.message.tool_calls, userMessageId)
    else: #No tool calls
        message_db[currentId] = {
            'message': {
                'role': 'assistant',
                'content': response.message.content or ""
            },
            'parentId': userMessageId
        }
        aiMessageId = currentId
        currentId += 1
        print(response)
        #if response.total_duration:
            #print(f"{Fore.LIGHTBLACK_EX + Style.DIM}[Thought for: {format_time(response.total_duration)}]")
        #print(f"{Fore.BLUE}\033[1m\033[4m{str.capitalize(response.message.role) + Style.RESET_ALL}: {Fore.LIGHTWHITE_EX}{response.message.content}{Style.RESET_ALL}")
        return response.message.content, userMessageId, aiMessageId, sys_msg_ids


simple_tools = ["getweather", "search_web", "get_current_timestamp", "execute_python_code"]
def toolHandler(tool_calls, userMessageId):
    global currentId
    global sys_msg_ids
    for tool in tool_calls:
        if tool.function.name in simple_tools:
            print("Model used: ", tool.function.name)
            tool_output = getattr(AITools, tool.function.name)(**tool['function']['arguments'])

            assistant_tool_msg_id = currentId
            currentId += 1
            message_db[assistant_tool_msg_id] = {
                'message': {
                    'role': 'assistant',
                    'content': "",
                    'tool_calls': tool_calls
                },
                'parentId': userMessageId
            }
            sys_msg_ids.append({"role": "assistant", "id": assistant_tool_msg_id, 'parentId': userMessageId})

            tool_msg_id = currentId
            currentId += 1
            message_db[tool_msg_id] = {
                'message': {
                    'role': 'tool',
                    'content': str(tool_output),
                    'name': tool.function.name
                },
                'parentId': assistant_tool_msg_id
            }
            sys_msg_ids.append({"role": "tool", "id": tool_msg_id, 'parentId': assistant_tool_msg_id})

            return simple_prompt(tool_msg_id, userMessageId)
        else:
            Warning("Module used unknow tool")


def simple_prompt(lastMsgId, userMessageId):
    global currentId
    history = getHistory(lastMsgId)

    print("Loading...")
    response = ollama.chat(
        model=model,
        messages=history,
        tools=model_tools,
        options=model_options,
    )

    if response.message.tool_calls: # Tool call happened
        print("214 Response with tool call: ", response)
        return toolHandler(response.message.tool_calls, userMessageId)
    else:
        aiMessageId = currentId
        currentId += 1
        message_db[aiMessageId] = {
            'message': {
                'role': 'assistant',
                'content': response.message.content or ""
            },
            'parentId': lastMsgId
        }

        print("241 simple_prompt response: ",response)
        return response.message.content, userMessageId, aiMessageId, sys_msg_ids