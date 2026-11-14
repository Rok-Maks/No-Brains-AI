//Elements
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const inputFileBtn = document.getElementById('file-btn');
const filesContainer = document.getElementById("files-container")

//Templates
const userMsgTmp = document.getElementById('user-message-template');
const aiMsgTmp = document.getElementById('ai-message-template');

//Varіables
userFiles = []
rows = 1
maxRows = 5
lastMessage = null

editEvents = new EventTarget()

function arraysEqual(a, b){
    return a.length === b.length && a.every((val, index) => val === b[index]);
}
function clamp(num, min=0, max){
    return Math.min(Math.max(num, min), max);   
}
class UserMessage {
    constructor(obj, text = "", files) {
        this.obj = obj
        this.text = text
        this.files = files
        this.nextMessage = []
    }

    clone() {
        let clone = new UserMessage(this.obj, this.text, this.files)
        clone.nextMessage = this.nextMessage
        clone.previousMessage = this.previousMessage
        return clone
    }

    async edit(newText, newFiles, branch = false) {
        if (this.id === undefined)
        {
            console.log("This message doesn`t have an id! It can`t be edited")
            return
        }
        
        console.log(newFiles)
        let formData = new FormData()
        formData.append('message', newText)
        formData.append('role', "user")
        if (newFiles)
            newFiles.forEach(file => {
                formData.append('files', file); // тут можна змінити ключ, якщо потрібно
            });
            console.log(formData)

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chat/edit/${this.id}?branch=${branch}`, {
                method: 'PUT',
                body: formData
            });

            let data = await response.json();
            if (branch === true){
                let clone = this.clone()
                clone.nextMessage = []
                clone.text = newText
                clone.id = data.newId
                clone.files = newFiles
                return clone
            }
            else{
                this.text = newText
                this.files = newFiles
            }
        }
        catch (error){
            console.log(error)
        }
    }
}


class AIMessage {
    constructor(obj, text = "", rawText) {
        this.obj = obj
        this.text = text
        this.rawText = rawText
        this.nextMessage = []
    }

    async edit(newText) {
        let formData = new FormData()
        formData.append('message', newText)
        formData.append('role', "assistant")
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chat/edit/${this.id}`, {
                method: 'PUT',
                body: formData
            });
            this.rawText = newText
        }
        catch (error){
            console.log(error)
        }
    }

    clone() {
        let clone = new AIMessage(this.obj, this.text, this.rawText)
        clone.nextMessage = this.nextMessage
        clone.previousMessage = this.previousMessage
        return clone
    }
}


function turnToTextField(textBox) {
    //Get text from textBox
    message_text = textBox.innerText
            
    //Hide message text
    textBox.innerText = ""

    //Create text field
    let text_field = document.createElement("textarea")
    text_field.className = "edit-box"
    text_field.value = message_text
    text_field.placeholder = "Write something..."
    textBox.append(text_field)
    text_field.focus()
    text_field.setSelectionRange(message_text.length, message_text.length);
    return text_field
}

function updateCounter(oldMsg, newMsg, navigationDiv){
    let counter = navigationDiv.querySelector('.counter')
    let previous = navigationDiv.querySelector('.previous')
    let next = navigationDiv.querySelector('.next')
    if (newMsg.previousMessage.nextMessage.length > 1){
        let messageIndex = newMsg.previousMessage.nextMessage.indexOf(newMsg)
        counter.innerHTML = (messageIndex+1) + "/" + newMsg.previousMessage.nextMessage.length
        previous.style.visibility = 'visible'
        next.style.visibility = 'visible'
        if (messageIndex === 0){
            previous.style.visibility = 'hidden'
        }
        else if(messageIndex === newMsg.previousMessage.nextMessage.length-1){
            next.style.visibility = 'hidden'
        }
        navigationDiv.style.visibility = 'visible'
    }
    else{
        navigationDiv.style.visibility = 'hidden'
    }

    // let previousMessage = newMsg.previousMessage
    // newMsg = previousMessage.currentNextMessage

    if (newMsg.nextMessage.length > 0){
        let nextMessage = newMsg.currentNextMessage || newMsg.nextMessage[0]
        while (true){
            nextMessage.obj.style.display = 'flex'
            if (nextMessage.nextMessage.length == 0) break
            nextMessage = nextMessage.currentNextMessage || nextMessage.nextMessage[0]
        }
        lastMessage = nextMessage
    }
    else{
        lastMessage = newMsg
    }

    if (oldMsg && oldMsg.nextMessage){
        nextMessage = oldMsg.currentNextMessage || oldMsg.nextMessage[0]
        while (nextMessage){
            if (nextMessage.obj){
                nextMessage.obj.style.display = 'none'
            }
            if (!nextMessage.nextMessage) break
            nextMessage = nextMessage.currentNextMessage || nextMessage.nextMessage[0]
        }
    }
}

async function requestAi(formData){
    console.log(formData) 
    const response = await fetch('http://127.0.0.1:5000/api/chat/prompt', {
        method: 'POST',
        body: formData 
    });
    
    data = await response.json();
    if (!data.error)
    {
        reply = marked.parse(data.reply)
    
        // 3. Відображаємо відповідь від ШІ
        let template = aiMsgTmp.content.cloneNode(true)
        let messageContainer = template.querySelector('.ai-answer')
        let textBox = messageContainer.querySelector('.chat-message')
        let navigationDiv = messageContainer.querySelector('.navigation-buttons')
        let previous = navigationDiv.querySelector('.previous')
        let next = navigationDiv.querySelector('.next')
        textBox.innerHTML = reply;
    
        const copy = template.querySelector('.copy')
        copy.addEventListener('click', (event) => {
            const text = textBox.innerText.slice(4);
            navigator.clipboard.writeText(text);
        })
    
        let ai_response = new AIMessage(messageContainer, reply, data.reply)
    
        //Edit button (AI side)
        let editBtn = template.querySelector('.edit')
        editBtn.addEventListener('click', (event) => {
            //Check id
            if (ai_response.id === undefined)
            {
                console.log("This message doesn`t have an id! It can`t be edited")
                return
            }

            editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: ai_response}}))
    
            // Hide text, show inputField
            textBox.innerHTML = ""
            editBtn.style.display = "none"
    
            //Array.from(textBox.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ")
            let rawText = ai_response.rawText
    
            //Create text field
            let text_field = document.createElement("textarea")
            text_field.className = "edit-box"
            text_field.value = rawText
            text_field.placeholder = "Write something..."
            textBox.append(text_field)
            text_field.focus()
            text_field.setSelectionRange(rawText.length, rawText.length);

            function stopEdit(event){
                if (event.detail.obj !== ai_response){
                    textBox.innerHTML = marked.parse(ai_response.rawText)
                    ai_response.text = marked.parse(ai_response.rawText)
                    text_field.remove()
                    editBtn.style.display = "flex"
                    editEvents.removeEventListener('stopEdit', stopEdit)
                }
            }
            
            // Enter || escape conntection (AI Side)
            text_field.addEventListener('keydown', async (event) => {
                if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
                    event.preventDefault();
                    editEvents.removeEventListener('stopEdit', stopEdit)
                    if (event.key === 'Enter') {
                        text_field.disabled = true;
                        await ai_response.edit(text_field.value);
                    }
                    else if (event.key === 'Escape'){
                        console.log(ai_response)
                    }
                    
                    textBox.innerHTML = marked.parse(ai_response.rawText)
                    ai_response.text = marked.parse(ai_response.rawText)
                    text_field.remove()
                    editBtn.style.display = "flex"
                }
            })



            editEvents.addEventListener('stopEdit', stopEdit)
        })
    
        let reroll = template.querySelector('.reroll')
        reroll.addEventListener('click', async event => {
            //Check id
            editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: undefined}}))
            if (ai_response.id === undefined)
            {
                console.log("This message doesn`t have an id! It can`t be edited")
                return
            }
            let response = await fetch(`http://127.0.0.1:5000/api/chat/reroll/${ai_response.id}`, {
                method: 'POST'
            });
            data = await response.json();
            if (data.error){
                console.log(data.error)
                return
            }
            let reply = marked.parse(data.reply)
            let newId = data.newId
            textBox.innerHTML = reply;
    
            let newMessage = ai_response.clone()
            newMessage.nextMessage = []
            newMessage.text = reply
            newMessage.rawText = data.reply
            newMessage.id = newId
            lastMessage = newMessage
            let oldMessage = newMessage.previousMessage.currentNextMessage
            newMessage.previousMessage.nextMessage.push(newMessage)
            newMessage.previousMessage.currentNextMessage = newMessage
            updateCounter(oldMessage, newMessage, navigationDiv)
        })
    
        previous.addEventListener('click', (event) => {
            editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: undefined}}))
            let previousMessage = ai_response.previousMessage
            if (previousMessage.nextMessage.length <= 1) return
            let oldMsg = previousMessage.currentNextMessage
            let oldMsgID = previousMessage.nextMessage.indexOf(oldMsg)
            if (oldMsgID <= 0) return                                       //change me
            
            let newMsg = previousMessage.nextMessage[oldMsgID-1]            //change me
            previousMessage.currentNextMessage = newMsg
            textBox.innerHTML = newMsg.text
            // lastMessage = newMsg
            
            updateCounter(oldMsg, newMsg, navigationDiv)
        })
    
        next.addEventListener('click', (event) => {
            editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: undefined}}))
            let previousMessage = ai_response.previousMessage
            if (previousMessage.nextMessage.length <= 1) return
            let oldMsg = previousMessage.currentNextMessage
            let oldMsgID = previousMessage.nextMessage.indexOf(oldMsg)
            if (oldMsgID >= previousMessage.nextMessage.length-1) return    //change me
            
            let newMsg = previousMessage.nextMessage[oldMsgID+1]            //change me
            previousMessage.currentNextMessage = newMsg
            textBox.innerHTML = newMsg.text
            // lastMessage = newMsg
            
            updateCounter(oldMsg, newMsg, navigationDiv)
        })
    
        chatWindow.append(template);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return [data, ai_response]
    }
    else{
        console.log(data.error)
        return [data, '']
    }
}

// Головна функція відправки повідомлення
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && userFiles.length == 0) return; // Якщо поле порожнє — нічого не робимо

    // 1. Відображаємо текст користувача в чаті
    let messageBox = userMsgTmp.content.cloneNode(true);
    let messageContainer = messageBox.querySelector('.user-message');
    let textBox = messageContainer.querySelector('.chat-message')
    let editBtn = messageBox.querySelector('.edit');
    let navigationDiv = messageContainer.querySelector('.navigation-buttons')
    let previous = navigationDiv.querySelector('.previous')
    let next = navigationDiv.querySelector('.next')
    let messageFileContainer = messageBox.querySelector(".message-file-container")
    let messageFileWrapper = messageFileContainer.querySelector(".message-file-wrapper")

    console.log()
    textBox.append(text)
    chatWindow.append(messageBox) 
    userInput.value = ''; // Очищаємо поле введення
    userInput.rows = 1
    chatWindow.scrollTop = chatWindow.scrollHeight; // Скролимо вниз
    sendBtn.dataset.active = "false";

    Array.from(filesContainer.getElementsByClassName('file')).map(node => node.remove());
    filesContainer.style.display = "none"

    let formData = new FormData() //a flat key-value Json container that also accepts binary stuff (aka files)
    formData.append('message', text)
    if (userFiles && userFiles.length > 0){
        messageContainer.style.paddingTop = "120px"
        messageFileContainer.style.display = 'flex'
        for (i = 0; i < userFiles.length; i++){
            let template = document.getElementById("file-template").content.cloneNode(true)
            let fileDiv = template.querySelector('.file');
            let button = template.querySelector('.remove-file-btn')
            let text = template.querySelector('p')

            let file = userFiles[i]
            formData.append("files", file); 
            
            button.style.visibility = "hidden"
            text.innerHTML = file.name
            fileDiv.savedFile = file
            messageFileWrapper.append(template)
            fitText(text)

            if (file.type.includes("image")){
                fileDiv.style.backgroundImage = `url(${file.imageURL})`
            }
            else{
                fileDiv.classList.remove("open-image")
            }
        }

    }
    let parentMessage = lastMessage
    if (parentMessage){
        formData.append('parentId', parentMessage.id)
    }
    let message_Obj = new UserMessage(messageContainer, text, formData.getAll('files'))

    if (parentMessage != undefined){
        message_Obj.previousMessage = parentMessage
        parentMessage.nextMessage.push(message_Obj)
        parentMessage.currentNextMessage = message_Obj
    }
    else{
        let previousMessage = new UserMessage("", undefined, undefined)
        previousMessage.currentNextMessage = message_Obj
        previousMessage.nextMessage.push(message_Obj)
        message_Obj.previousMessage = previousMessage
    }

    //Edit Button Setup (client)
    editBtn.addEventListener('click', (event) => {
        let text_field = turnToTextField(message_Obj.obj.querySelector(".chat-message"))
        let currentMessage = message_Obj.previousMessage.currentNextMessage
        let filesToAdd = []
        editBtn.style.display = "none"
        
        function stopEdit(event = undefined){
            if (!(event && event.detail.obj === message_Obj)){
                textBox.innerHTML = currentMessage.text
                text_field.remove()
                editBtn.style.display = "flex"
                editEvents.removeEventListener('stopEdit', stopEdit)

                Array.from(messageFileContainer.getElementsByClassName('file')).forEach(element => {
                    if (currentMessage.files.includes(element.savedFile)){
                        let button = element.querySelector('.remove-file-btn')
                        button.style.visibility = 'hidden'
                        button.removeEventListener('click', removeFile)
                        element.style.display === 'flex'
                    }
                    else{
                        console.log(currentMessage.files.includes(element.savedFile))
                        console.log(currentMessage.files, element.savedFile)
                        let button = element.querySelector('.remove-file-btn')
                        button.removeEventListener('click', removeFile)
                        element.remove();
                    }
                });

                if (!Array.from(messageFileContainer.children).some(node => { console.log(node.style.display !== "none", node); return node.style.display !== "none"})) {
                    messageContainer.style.paddingTop = "0"
                    messageFileContainer.style.display = 'none'
                }
            }
        }

        editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: message_Obj}}))

        function removeFile(event) {
            const button = event.currentTarget;
            const element = button.closest('.file');
            element.style.display = 'none'
            if (!Array.from(element.parentElement.children).some(node => { console.log(node.style.display !== "none", node); return node.style.display !== "none"})) {
                messageContainer.style.paddingTop = "0"
                messageFileContainer.style.display = 'none'
            }
        }
        Array.from(messageFileContainer.getElementsByClassName('file')).forEach(element => {
            let button = element.querySelector('.remove-file-btn')
            button.style.visibility = 'visible'
            button.addEventListener('click', removeFile)
        });

        text_field.addEventListener("paste", (e)=>{
            const items = (e.clipboardData || window.clipboardData).items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].kind.indexOf('file') !== -1) {
                    file = items[i].getAsFile()

                    messageContainer.style.paddingTop = "120px"
                    messageFileContainer.style.display = 'flex'
                    let template = document.getElementById("file-template").content.cloneNode(true)
                    let fileDiv = template.querySelector('.file');
                    let button = template.querySelector('.remove-file-btn')
                    let text = template.querySelector('p')
                 
                    text.innerHTML = file.name
                    fileDiv.savedFile = file
                    messageFileWrapper.append(template)
                    fitText(text)

                    if (file.type.includes("image")){
                        let imageURL = URL.createObjectURL(file)
                        fileDiv.style.backgroundImage = `url(${imageURL})`
                        file.imageURL = imageURL
                    }
                    else{
                        fileDiv.classList.remove("open-image")
                    }
                    
                    filesToAdd.push(file)
                }
            }
        })

        // Enter || escape conntection
        text_field.addEventListener('keydown', async (event) => {
            if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
                event.preventDefault();
                editEvents.removeEventListener('stopEdit', stopEdit)
                if (event.key === 'Enter') {
                    let branch = event.ctrlKey //If ctrl is pressed - create a new branch
                    text_field.disabled = true;
                    
                    //Delete removed files
                    let newFiles = [...currentMessage.files]
                    Array.from(messageFileContainer.getElementsByClassName('file')).forEach(element => {
                        if (element.style.display === 'none'){
                            let button = element.querySelector('.remove-file-btn')
                            button.removeEventListener('click', removeFile)
                            const file = element.savedFile;
                            const index = newFiles.indexOf(file);
                            if (index !== -1) {
                                console.log("File removed")
                                newFiles.splice(index, 1);
                            }
                            else{
                                console.log("File wasn't removed: ", newFiles, file)
                            }
                            element.remove();
                        }
                    });

                    filesToAdd.forEach(file => {newFiles.push(file)});
                    console.log(newFiles)
                    let newMessage = await currentMessage.edit(text_field.value, newFiles, branch) // Передати зміни серверу, щоб видалити файли
                    currentMessage = newMessage || currentMessage
                    console.log(newMessage)
                    console.log(currentMessage)
                    
                    if (branch){
                        parentMessage = newMessage
                        let oldMessage = newMessage.previousMessage.currentNextMessage
                        newMessage.previousMessage.nextMessage.push(newMessage)
                        newMessage.previousMessage.currentNextMessage = newMessage
                        updateCounter(oldMessage, newMessage, navigationDiv)
                        
                        let formData = new FormData() //a flat key-value Json container that also accepts binary stuff (aka files)
                        formData.append('message', newMessage.text)
                        if (newMessage.previousMessage.id){
                            formData.append('parentId', newMessage.previousMessage.id)//parent id
                        }
                        if (newMessage.files && newMessage.files.length > 0){
                            for (i = 0; i < newMessage.files.length; i++){
                                formData.append("files", newMessage.files[i]);
                            }
                        }
                        
                        let fdata = Object.fromEntries(formData)
                        console.log(fdata)
                        let [data, ai_response] = await requestAi(formData)
                        //Assign user message ID
                        if (data.userMessageId !== undefined){
                            newMessage.id = data.userMessageId
                            newMessage.nextMessage.push(ai_response)
                            newMessage.currentNextMessage = ai_response
                        }
                        else{
                            console.error("No id given to user message ", data.userMessageId, data)
                        }

                        //Assign ai response ID
                        if (data.aiMessageId !== undefined){
                            ai_response.id = data.aiMessageId
                            ai_response.previousMessage = newMessage
                            parentMessage = ai_response}
                        else{
                            console.error("No id given to user message ", data)
                        }
                    }
                    else{
                        console.log(currentMessage)
                    }
                }
                // else if(event.key === 'Escape'){}
                stopEdit()
            }
        })
        editEvents.addEventListener('stopEdit', stopEdit)
    })


    previous.addEventListener('click', (event) => {
        editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: undefined}}))
        let previousMessage = message_Obj.previousMessage
        if (previousMessage.nextMessage.length <= 1) return
        let oldMsg = previousMessage.currentNextMessage
        let oldMsgID = previousMessage.nextMessage.indexOf(oldMsg)
        if (oldMsgID <= 0) return                                       //change me
        
        let newMsg = previousMessage.nextMessage[oldMsgID-1]            //change me
        previousMessage.currentNextMessage = newMsg
        textBox.innerHTML = newMsg.text
        // lastMessage = newMsg
        
        updateCounter(oldMsg, newMsg, navigationDiv)
    })

    next.addEventListener('click', (event) => {
        editEvents.dispatchEvent(new CustomEvent('stopEdit', {detail: {obj: undefined}}))
        let previousMessage = message_Obj.previousMessage
        if (previousMessage.nextMessage.length <= 1) return
        let oldMsg = previousMessage.currentNextMessage
        let oldMsgID = previousMessage.nextMessage.indexOf(oldMsg)
        if (oldMsgID >= previousMessage.nextMessage.length-1) return    //change me
        
        let newMsg = previousMessage.nextMessage[oldMsgID+1]            //change me
        previousMessage.currentNextMessage = newMsg
        textBox.innerHTML = newMsg.text
        // lastMessage = newMsg
        
        updateCounter(oldMsg, newMsg, navigationDiv)
    })

    // 2. Надсилаємо запит на наш Python-бекенд (PROMPT)
    try {
        let [data, ai_response] = await requestAi(formData)
        if (!data.error){
            //Assign user message ID
            if (data.userMessageId !== undefined){
                message_Obj.id = data.userMessageId
                message_Obj.nextMessage.push(ai_response)
                message_Obj.currentNextMessage = ai_response
            }
            else{
                console.error("No id given to user message ", data.userMessageId, data)
            }

            //Assign ai response ID
            if (data.aiMessageId !== undefined){
                if (message_Obj.obj.style.display === 'none'){
                    ai_response.obj.style.display = 'none'
                }
                else{
                    lastMessage = ai_response
                }
                ai_response.id = data.aiMessageId
                ai_response.previousMessage = message_Obj
                }
            else
                console.error("No id given to AI message ", data)
        }
        else{
            console.log(data.error)
            messageContainer.remove()
            messageBox = undefined
            messageContainer = undefined
            textBox = undefined
            editBtn = undefined
            navigationDiv = undefined
            previous = undefined
            next = undefined
            message_Obj = undefined
        }

    } catch (error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red'
        errorDiv.style.marginBottom = "10px"
        errorDiv.innerHTML = "<b>Помилка:</b> Не вдалося з'єднатися з бекендом</div>"
        chatWindow.append(errorDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Скролимо вниз
        console.log(error)
    }

    userFiles = []
}

//Clear Button
clearBtn.addEventListener('click', () => {
    chatWindow.innerHTML = ``;
    lastMessage = null
    fetch('http://127.0.0.1:5000/api/chat/clear', {
        method: 'POST',
    });
});

function loadFile(file){
    if (!file) return
    sendBtn.dataset.active = "true";
    const template = document.getElementById("file-template").content.cloneNode(true)
    const button = template.querySelector('.remove-file-btn');
    const fileDiv = template.querySelector('.file');
    const text = template.querySelector('p')
    text.innerHTML = file.name
    userFiles.push(file)
    button.addEventListener('click', (event) => {
        const index = userFiles.indexOf(file);
        userFiles.splice(index, 1)
        fileDiv.remove()
        if (userFiles.length == 0) {
            sendBtn.dataset.active = "false";
            filesContainer.style.display = "none"
        }
    })
    filesContainer.append(template)
    filesContainer.style.display = "flex"
    fitText(text)
    if (file.type.includes("image")){
        imageURL = URL.createObjectURL(file)
        fileDiv.style.backgroundImage = `url(${imageURL})`
        file.imageURL = imageURL
    }
    else{
        fileDiv.classList.remove("open-image")
    }
    //URL.revokeObjectURL(imageURL);
}

//File Input
inputFileBtn.addEventListener('change', () => {
    const selectedFiles = inputFileBtn.files;
    for (i = 0;  i < selectedFiles.length; i++){
        loadFile(selectedFiles[i])
    }
})
// Подія 1: Клік по кнопці "Надіслати"
sendBtn.addEventListener('click', sendMessage);

// Подія 2: Натискання клавіші в інпуті
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
userInput.addEventListener('input', event => {
    userInput.rows = 1;
    const computedStyle = window.getComputedStyle(userInput);
    const lineHeight = parseInt(computedStyle.lineHeight); 
    const totalHeight = userInput.scrollHeight - (parseInt(computedStyle.paddingTop) || 0) - (parseInt(computedStyle.paddingBottom) || 0);
    const currentLines = Math.floor(totalHeight / lineHeight);
    userInput.rows = Math.min(currentLines, 5);
    userInput.scrollTop = userInput.scrollHeight;
    
    const text = userInput.value.trim();
    if (!text) sendBtn.dataset.active = "false";
    else sendBtn.dataset.active = "true";
});


const fileData = new WeakMap();
function fitText(element) {
    if (!fileData.get(element))
        fileData.set(element, element.innerHTML);
    
    text = fileData.get(element)
    dotIndex = text.lastIndexOf('.');
    const partA = text.slice(0, dotIndex-1);
    const partB = text.slice(dotIndex-1);
    var i = 1;
    while (element.scrollWidth > element.parentElement.clientWidth)
    {
        element.innerHTML = partA.slice(0,-i) + "..." + partB;
        i++;
    }
}

userInput.addEventListener('paste', (e) => {
    // Отримуємо елементи з буфера обміну
    const items = (e.clipboardData || window.clipboardData).items;
    if (!items) return;

    // Шукаємо серед скопійованих елементів саме зображення
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind.indexOf('file') !== -1) {
            console.log(items[i])
            loadFile(items[i].getAsFile())
        }
    }
})






//SETTINGS
let flex_cont = document.querySelector(".flex-container")
let settings_menu = flex_cont.querySelector("#settings")
let close_btn = settings_menu.querySelector(".close-btn")
let settings_btn = document.querySelector("#settings-btn")

let modal_cont = document.querySelector("#modal-container")
let modal_image = document.querySelector(".modal-image")

//fields
let model_options = settings_menu.querySelector("#model-select")
let num_ctx = settings_menu.querySelector("#num_ctx")
let num_predict = settings_menu.querySelector("#num_predict")
let temperature = settings_menu.querySelector("#temperature")
let top_p = settings_menu.querySelector("#top_p")
let top_k = settings_menu.querySelector("#top_k")

//sliders
let temperature_slider = settings_menu.querySelector(".temperature.range-value")
let top_p_slider = settings_menu.querySelector(".top_p.range-value")

let defaultSettings  = {
    modelName: "instruct-abliterated",
    num_ctx: 8192,
    num_predict: 1024,
    temperature: "1.00",
    top_p: "0.95",
    top_k: 50,
}
let settings_data = JSON.parse(localStorage.getItem("settings")) || defaultSettings
let settings_fetched = false
try{
    fetch(`http://127.0.0.1:5000/api/chat/settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings_data)
    });
    settings_fetched = true
}
catch(err){
    console.error(err)
}
console.log(settings_data)

model_options.value = settings_data["modelName"]
num_ctx.value = settings_data["num_ctx"]
num_predict.value = settings_data["num_predict"]
temperature.value = parseFloat(settings_data["temperature"]).toFixed(2)
top_p.value = parseFloat(settings_data["top_p"]).toFixed(2)
top_k.value = settings_data["top_k"]
temperature_slider.value = settings_data["temperature"]
top_p_slider.value = settings_data["top_p"]


async function saveSettingsData(){
    let new_stngs = {}
    new_stngs["modelName"] = model_options.value
    new_stngs["num_ctx"] = parseFloat(num_ctx.value) || 0
    new_stngs["num_predict"] = parseFloat(num_predict.value) || 0
    new_stngs["temperature"] = parseFloat(temperature.value) || 0
    new_stngs["top_k"] = parseFloat(top_k.value) || 0
    new_stngs["top_p"] = parseFloat(top_p.value) || 0
    if (JSON.stringify(new_stngs) !== JSON.stringify(settings_data) || !settings_fetched){
        console.log(settings_data)
        const response = await fetch(`http://127.0.0.1:5000/api/chat/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // <--- Оце обов'язково для JSON
            },
            body: JSON.stringify(new_stngs)
        });
        settings_data = new_stngs
        settings_fetched = true
        console.log(settings_data)
    }
    localStorage.setItem("settings", JSON.stringify(settings_data))
}

settings_btn.addEventListener('click', (e)=>{
    flex_cont.style.visibility = "visible"
    flex_cont.style["backdrop-filter"] = "blur(2px)"
    settings_menu.style.transform = "translate(0, 0)"
    flex_cont.style["z-index"] = "4"
})

let mouse_down_target

flex_cont.addEventListener('click', async (e)=>{
    console.log(mouse_down_target, e.target.classList)
    if (mouse_down_target === e.target && e.target.classList.contains("close-trigger")){
        flex_cont.style.visibility = "hidden"
        flex_cont.style["backdrop-filter"] = "blur(0)"
        settings_menu.style.transform = "translate(0, 100vh)"
        flex_cont.style["z-index"] = "2"
        modal_cont.style.visibility = "hidden"
        modal_image.style.transform = "scale(0.1)"
        await saveSettingsData()
        mouse_down_target = undefined
    }
})

flex_cont.addEventListener('mousedown', async (e)=>{
    if (e.target.classList.contains("close-trigger")){
        mouse_down_target = e.target
    }
})

top_p_slider.addEventListener("input", (e)=>{
    top_p.value = parseFloat(top_p_slider.value).toFixed(2)
})

top_p.addEventListener("input", (e)=>{
    top_p_slider.value = parseFloat(top_p.value)
})
top_p.addEventListener("blur", (e)=>{
    top_p.value =(clamp(parseFloat(top_p.value.replaceAll(",", ".")) || 0, 0, 1)).toFixed(2)
})
top_p.addEventListener("focus", (e)=>{
    top_p.value = Math.round(parseFloat(top_p.value)*100)/100
    top_p.setSelectionRange(0, top_p.value.length);
})



temperature_slider.addEventListener("input", (e)=>{
    temperature.value = parseFloat(temperature_slider.value).toFixed(2)
})

temperature.addEventListener("input", (e)=>{
    temperature_slider.value = parseFloat(temperature.value)
})
temperature.addEventListener("blur", (e)=>{
    temperature.value =(clamp(parseFloat(temperature.value.replaceAll(",", ".")) || 0, 0, 2)).toFixed(2)
})
temperature.addEventListener("focus", (e)=>{
    temperature.value = Math.round(parseFloat(temperature.value)*100)/100
    temperature.setSelectionRange(0, temperature.value.length);
})


num_ctx.addEventListener("blur", (e)=>{
    num_ctx.value = parseInt(num_ctx.value) || 0
})
num_predict.addEventListener("blur", (e)=>{
    num_predict.value = parseInt(num_predict.value) || 0
})
top_k.addEventListener("blur", (e)=>{
    top_k.value = parseInt(top_k.value) || 0
})


//Image modal window
function adjustImageSize() {
    const img = modal_image;
    const container = modal_image.parentElement;

    // Отримуємо реальні розміри картинки
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Отримуємо поточні розміри контейнера
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Раховуємо коефіцієнт масштабування (як у contain)
    const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);

    // Кінцеві розміри картинки
    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;

    // Примусово задаємо їх тегу img — тепер рамка ляже ідеально навколо картинки!
    img.style.width = `${displayWidth}px`;
    img.style.height = `${displayHeight}px`;
}


document.querySelector("body").addEventListener('click', (e)=>{
    let target = e.target.classList.contains("open-image") ? e.target : e.target.closest(".open-image")
    if (target && !e.target.classList.contains("remove-file-btn")){
        console.log(target, target.classList)
        let image = target.style["background-image"].replaceAll('url("', "").replaceAll('")', "")
        modal_image.src = image
        adjustImageSize()
        flex_cont.style.visibility = "visible"
        flex_cont.style["backdrop-filter"] = "blur(2px)"
        flex_cont.style["z-index"] = "4"
        modal_cont.style.visibility = "visible"
        modal_image.style.transform = "scale(1)"
    }
})

