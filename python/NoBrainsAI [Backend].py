from flask import Flask, request, jsonify
from flask_cors import CORS
from setuptools.wheel import unpack
from sympy.parsing.sympy_parser import null

from AIImportable import promptAI, clearHistory, editMessage, rerollMessage, set_settings

#stop simultaneous editing

rerollDebounce = {}
promtDebounce = {}
app = Flask(__name__)
CORS(app)  # Дозволяємо запити з нашого індексу
IMAGEFORMATS = ['.png', '.jpg', '.jpeg', '.webp']
OTHERFORMATS = [
    "txt", "md", "markdown", "json", "jsonl", "xml", "yaml", "yml", "toml",
    "ini", "cfg", "env", "csv", "tsv", "html", "htm", "css", "rtf", "log",
    "py", "cs", "csx", "cpp", "hpp", "c", "h", "lua", "js", "jsx", "ts",
    "tsx", "go", "rs", "java", "kt", "swift", "rb", "php", "sql", "sh",
    "bash", "bat", "cmd", "ps1", "asm", "s"
]
def decode_TXT(file):
    return file.read().decode('utf-8', errors='ignore')

def getFromData(data):
    user_message = data.get('message', '')
    uploaded_files = request.files.getlist('files')
    images = []
    textFiles = []
    text = ""
    for file in uploaded_files:
        print(file, file.filename)
        if file and file.filename != '':
            print(file.filename.lower(), file.filename.lower().endswith(tuple(IMAGEFORMATS)))
            if file.filename.lower().endswith(tuple(IMAGEFORMATS)):
                file_bytes = file.read()
                images.append(file_bytes)
                print(f"Успішно зчитано {len(file_bytes)} байт картинки прямо з пам'яті")
            elif file.filename.lower().endswith(tuple(OTHERFORMATS)):
                textFiles.append({"Name": file.filename, "Content": decode_TXT(file)})

    if len(textFiles) > 0:
        text = r"'''User attached following text files to the prompt'''\n\n"
        for i, file in enumerate(textFiles):
            text += f"[{i}] File name: {file["Name"]}\nFile content: {file["Content"]}\n\n"
        text += "\n'''User`s prompt:'''"
    user_message = text + user_message
    return user_message, images

def get_ai_response(user_text, images = None, parentId = None):
    return promptAI(user_text, images, [], parentId = parentId)


@app.route('/api/chat/prompt', methods=['POST'])
def prompt():
    data = request.form
    parentId = data.get('parentId', None)
    if parentId not in promtDebounce.keys():
        promtDebounce[parentId] = True
        # print("Data: ", data)
        user_message,images  = getFromData(data)
        ai_reply, userMessageId, aiMessageId, sys_msg_ids = get_ai_response(user_message, images, parentId)
        print(ai_reply)
        ai_reply = "<b>AI:</b> " + ai_reply
        promtDebounce.pop(parentId)
        return jsonify({'reply': ai_reply, 'userMessageId': userMessageId, 'aiMessageId': aiMessageId, 'sys_msg_ids': sys_msg_ids})
    else:
        return jsonify({'error': 'wait a bit, woudn`t ya?'})


@app.route('/api/chat/edit/<int:id>', methods=["PUT", "OPTIONS"])
def edit(id): #getting value from int: id
    branch = request.args.get('branch', 'false').lower() == 'true'
    data = request.form
    # print("Data: ", data)
    # print("Files:",  data.get("files"))
    user_message,images = getFromData(data)
    role = data.get('role', 'user')
    newId = editMessage(id, user_message, images, role, branch)
    return jsonify({'success': True, 'newId': newId})

@app.route('/api/chat/reroll/<int:id>', methods=["POST"])
def reroll(id):
    if id not in rerollDebounce.keys():
        rerollDebounce[id] = True
        ai_reply, newId = rerollMessage(id)
        ai_reply = "<b>AI:</b> " + ai_reply
        rerollDebounce.pop(id)
        return jsonify({'reply': ai_reply, 'newId': newId})
    else:
        return jsonify({'error': 'wait a bit, woudn`t ya?'})


@app.route('/api/chat/settings', methods=['POST'])
def settings():
    data = request.json
    print(data)
    set_settings(data)
    return '', 204


@app.route('/api/chat/clear', methods=['POST'])
def clear():
    global rerollDebounce
    global promtDebounce
    clearHistory()
    rerollDebounce = {}
    promtDebounce = {}
    print("History cleared!")
    return '', 204



if __name__ == '__main__':
    # Запускаємо сервер на 5000 порту
    app.run(debug=True, port=5000)