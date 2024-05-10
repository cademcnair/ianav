let global_speed = 8
if (localStorage.getItem("speed")) {
    global_speed = Number(localStorage.getItem("speed"))
}
let prev_data = ""
async function write(stuff, clear = "true", speed = global_speed) {
    let d = 0
    let e = document.querySelector(".write")
    if (clear == "true") {
        e.innerHTML = ""
    } else if (clear == "prev") {
        e.innerHTML = prev_data
    } else if (clear == "prevlog") {
        e.innerHTML = prev_data
    } else if (clear == "noprev") void(0);
      else prev_data = e.innerHTML
    let img = false;
    let input = false;
    console.log(stuff)
    for (const value of stuff) { 
        console.log(value)
        if (d % 2 == 0) {
            value.split(",").forEach(i => {
                const data = i.split("#")
                const split = data[0].split(".")
                const elem = document.createElement(split[0])
                split.forEach((ii, dd) => {
                    if (dd == 0) return
                    elem.classList.add(ii)
                })
                if (data.length == 2) {
                    console.log(split[0])
                    if (split[0] == "img") {
                        elem.setAttribute("src", data[1]);
                        img = true; d++;
                    } else if (split[0] == "input") {
                        elem.setAttribute("type", data[1]);
                    } else elem.setAttribute("data", data[1])
                } 
                input = split[0] == "input"
                e.appendChild(elem); e = elem
            })
        }
        if (d % 2 == 1) {
            if (input == true) {
                console.log(value)
                e.setAttribute("placeholder", value)
                e = document.querySelector(".write")
                input = false; d++; continue;
            }
            if (img == true) {
                e = document.querySelector(".write")
                img = false; d++; continue;
            }
            if (speed == 0) {
                e.innerHTML = value;
                e = document.querySelector(".write")
            } else {
                let message = value
                let complete = null;
                let int = setInterval(() => {
                    e.innerHTML += message[0]
                    message = message.substring(1)
                    if (message.length == 0) {
                        clearInterval(int)
                        complete()
                    }
                }, speed)
                await new Promise((r) => {complete = r})
                e = document.querySelector(".write")
            }
        }
        d++;
    }
    if (clear == "prevlog" || clear == "true") prev_data = document.querySelector(".write").innerHTML
}
async function select(opt, q_speed = 0, s_speed = 0) {
    await write(opt.map((i, d) => [
        `button#${d}`, i
    ]).flat(), "false", q_speed)
    let resolve = null, selected = -1;
    document.querySelectorAll("button").forEach(e => e.onclick = function () {
        selected = Number(this.getAttribute("data")); resolve()
    })
    await new Promise(r => resolve = r)
    await write([
        "p,b", `✅   Selected "${opt[selected]}"`
    ], "prevlog", s_speed)
    return selected
}
async function confirm(text, t_speed = global_speed) {
    await write([
        "button.__confirm__", text
    ], "noprev", t_speed)
    await new Promise(r => document.querySelector(".__confirm__").onclick = r)
}
async function input(
    placeholder, validators = [], invalid_feedback = false, 
    q_speed = global_speed, b_speed = global_speed, s_speed = 0
) {
    let ans = ""
    let first = true
    while (true) {
        await write([!first ? ["p,b", `🚫   Please enter a valid input` + (
            invalid_feedback != false ? ` (must be ${invalid_feedback})` : ""
        )] : [], [
            "input.__question__", placeholder
        ]].flat(), "prev", q_speed)
        first = false;
        await confirm("Submit", b_speed)
        ans = document.querySelector("input.__question__").value
        let correct = true;
        for (const validator of validators) {
            let result = validator(ans);
            if (result instanceof Promise) {
                console.log("INSTANCE OF PROMISE")
                if (await Promise.resolve(result)) correct = false;
            } else if (!result) correct = false;
        }
        if (correct) break;
    }
    await write([
        "p,b", `✅   Inputted "${ans}"`
    ], "prevlog", s_speed)
    return ans

}