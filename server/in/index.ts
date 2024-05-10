import * as T from "./types"
import express from "express"
import path from "node:path"
import fs from "node:fs"
import cors from "cors"

const app = express()
const p = (f: TemplateStringsArray) => path.join(__dirname, f[0])
const c = <C>(a: C): C => JSON.parse(JSON.stringify(a))

// note: room IDs can also be places in the hallway
// file connects the different room IDs in the building
const relations: T.Relations = JSON.parse(fs.readFileSync(p`relations.json`).toString("utf-8"))
// file gives directions between connected room IDs
const directions: T.Directions = JSON.parse(fs.readFileSync(p`directions.json`).toString("utf-8"))
// file maps room locations/numbers to room IDs
const rooms: T.Rooms = JSON.parse(fs.readFileSync(p`rooms.json`).toString("utf-8"))
// file gives information on halls
const halls: T.Halls = JSON.parse(fs.readFileSync(p`halls.json`).toString("utf-8"))
// connects parent room IDs to halls
const halls_halls: T.HallsHalls = JSON.parse(fs.readFileSync(p`halls-halls.json`).toString("utf-8"))
// connects rooms IDs to their halls
const rooms_halls: T.RoomsHalls = JSON.parse(fs.readFileSync(p`rooms-halls.json`).toString("utf-8"))
const flipped_rooms: T.FlippedRooms = {};
(Object.entries(rooms) as [T.RoomID, number | string][]).forEach((i) => {
    if (Array.isArray(i[1])) {
        flipped_rooms[i[1][0]] = i[0]
        flipped_rooms[i[1][1]] = i[0]
    } else flipped_rooms[i[1]] = i[0]
})

const get_regex = /[123]-[A-Z]?[0-9]+/
const room_regex = /[123][1-9]{2}(.[123])?/
const places = [
    "FRONT", "BACK", "HANGER",
    "EXCHANGE 2", "EXCHANGE 3"
]
app.use(cors())
app.get("/:room", (req, res) => {
    // checks if input (location/room number) has matching room ID
    if (typeof req.params.room == "string") req.params.room = req.params.room.toUpperCase()
    if (req.params.room.match(room_regex) == null && !places.includes(req.params.room)) {
        res
            .status(400)
            .send("From param must match regex /[123][1-9]{2}(.[123])?/ or be FRONT/BACK/EXCHANGE 2/EXCHANGE 3/HANGER")
        return
    }
    const to_num = Number(req.params.room)
    if (isNaN(to_num) ? !places.includes(req.params.room) : !flipped_rooms[to_num]) {
        res
            .status(404)
            .send("Location may not be a room, or may not have an L-ID")
        return
    }
    res
        .status(200)
        .send(flipped_rooms[isNaN(to_num) ? req.params.room : to_num])
})
app.get("/:from/:to", (req, res) => {
    // start timer
    const start = Date.now()
    // make sure request format is correct
    if (req.params.from.match(get_regex) == null) {
        res
            .status(400)
            .send("From param must match regex /[123]-[A-Z]?[0-9]+/")
        return
    }
    if (req.params.to.match(get_regex) == null) {
        res
            .status(400)
            .send("To param must match regex /[123]-[A-Z]?[0-9]+/")
        return
    }
    if (!relations[req.params.from as T.RoomID]) {
        res
            .status(404)
            .send("From location not found")
        return
    }
    if (!relations[req.params.to as T.RoomID]) {
        res
            .status(404)
            .send("To location not found")
        return
    }
    /* const from_floor = req.params.from.split("")[0]
       const to_floor = req.params.to.split("")[0]
       let found_floor = from_floor == to_floor
       // note: found_floor makes bfs faster but may make it less correct */
    // BFS https://www.geeksforgeeks.org/breadth-first-search-or-bfs-for-a-graph/
    const visited: T.U.Visited = {} as T.U.Visited;
    const goal: T.RoomID = req.params.to as T.RoomID
    const going: T.RoomID[][] = [[req.params.from as T.RoomID]]
    let failed = false
    let ans: T.RoomID[] = []
    while (true) {
        if (going.length == 0) {
            failed = true
            break
        }
        const front = going[0]
        const at = front[front.length - 1]
        going.splice(0, 1)
        if (visited[at]) continue
        visited[at] = true;
        /* if (found_floor && at.split("")[0] != to_floor) continue */
        if (relations[at].includes(goal)) {
            ans = front; 
            ans.push(goal);
            break
        } else {
            relations[at].forEach(i => {
                if (visited[i]) return
                /* if (found_floor && i.split("")[0] != to_floor) return
                   if (!found_floor && i.split("")[0] == to_floor) found_floor = true */
                const arr = c(front)
                arr.push(i)
                going.push(arr)
            })
        }
    }
    if (failed) {
        res
            .status(404)
            .send("Pathway was not found")
    } else {
        let prev: null | T.RoomID = null
        const steps: string[] = []
        let spans: T.U.Spans = {} as T.U.Spans
        let shortcuts: T.Shortcut[] = []
        // look for shortcuts
        ans.forEach((i, d) => {
            if (!rooms_halls[i] && !halls_halls[i]) {
                spans = {} as T.U.Spans
            } else {
                const contains: T.HallID[] = []
                // add all hals to the spans list
                if (rooms_halls[i]) {
                    contains.push(rooms_halls[i])
                } else {
                    halls_halls[i].forEach(ii => contains.push(ii))
                }
                (Object.keys(spans) as T.HallID[]).forEach(ii => {
                    if (!contains.includes(ii)) delete spans[i as T.HallID]
                })
                contains.forEach(ii => {
                    if (spans[ii]) spans[ii]++
                    else if (rooms_halls[i]) spans[ii] = 1
                    // if room-hall-room all are in same highway, shortcut is possible
                    if (spans[ii] == 3) {
                        let from = ans[d - 2]
                        let room_from: number = Array.isArray(rooms[from]) ? (rooms[from] as [number, number])[0] : Number(rooms[from])
                        let room_to: number = Array.isArray(rooms[i]) ? (rooms[i] as [number, number])[0] : Number(rooms[i])
                        let destination: string = Array.isArray(rooms[i]) ? (rooms[i] as number[]).join("/") : String(rooms[i]) as string
                        let side: T.SOS = 
                            (room_from%2) == (room_to%2)
                            ? "same side" : "opposite side"
                        let hall: T.HallsValue = halls[ii]
                        let hall_parent = hall.parent
                        let hall_direction = hall.direction
                        let from_dist: T.DD[] = hall.children.filter(iii => iii[0] == from).map(iii => iii[1])
                        let to_dist: T.DD[] = hall.children.filter(iii => iii[0] == i).map(iii => iii[1])
                        let from_to_parent = String(directions[`${from},${hall_parent}`])
                        let from_to_parent_direction: T.LRS = 
                            from_to_parent.startsWith("Go left") 
                            || from_to_parent == "left" ? 
                            "left" : "right"
                        let specific_from_door: false | T.Compass = false
                        const dist = (one: number, two: number): number => Math.abs(one - two)
                        if (from_dist.length == 1) {
                            if (to_dist.length == 1) {
                                // if both rooms have 1 door
                                // from: 1, to: 1
                                if (from_dist[0] == to_dist[0]) {
                                    from_to_parent_direction = "straight"
                                }
                                if (to_dist[0] > from_dist[0]) {
                                    from_to_parent_direction = from_to_parent_direction == "left" ? "right" : "left"
                                }
                            } else {
                                // if 1 door -> 2 doors
                                let using_to = dist(to_dist[0], from_dist[0]) >= dist(to_dist[1], from_dist[0]) ? to_dist[1] : to_dist[0]
                                if (from_dist[0] == to_dist[0]) {
                                    from_to_parent_direction = "straight"
                                }
                                if (using_to > from_dist[0]) {
                                    from_to_parent_direction = from_to_parent_direction == "left" ? "right" : "left"
                                }
                                // from: 1, to: 2
                            }
                        } else if (to_dist.length == 1) {
                            // if 2 doors -> 1 door
                            let using_from = dist(to_dist[0], from_dist[0]) >= dist(to_dist[0], from_dist[1]) ? from_dist[1] : from_dist[0]
                            if (from_dist[0] > from_dist[1]) {
                                if (using_from == from_dist[0]) {
                                    specific_from_door = hall_direction[1]
                                } else specific_from_door = hall_direction[0]
                            } else {
                                if (using_from == from_dist[1]) {
                                    specific_from_door = hall_direction[1]
                                } else specific_from_door = hall_direction[0]
                            }
                            if (using_from == to_dist[0]) {
                                from_to_parent_direction = "straight"
                            }
                            if (to_dist[0] > using_from) {
                                from_to_parent_direction = from_to_parent_direction == "left" ? "right" : "left"
                            }
                            // from: 2, to: 1
                        } else {
                            // if 2 doors -> 2 doors
                            let going_straight: null | 0 | 1 = null
                            if (from_dist[0] == to_dist[0] || from_dist[0] == to_dist[1]) {
                                going_straight = 0; from_to_parent_direction = "straight" 
                            }
                            if (from_dist[1] == to_dist[0] || from_dist[1] == to_dist[1]) {
                                going_straight = 1; from_to_parent_direction = "straight"
                            }
                            if (going_straight != null) {
                                let using_from = from_dist[going_straight]
                                if (from_dist[0] > from_dist[1]) {
                                    if (using_from == from_dist[0]) {
                                        specific_from_door = hall_direction[1]
                                    } else specific_from_door = hall_direction[0]
                                } else {
                                    if (using_from == from_dist[1]) {
                                        specific_from_door = hall_direction[1]
                                    } else specific_from_door = hall_direction[0]
                                }
                            } else {
                                let dists = [
                                    dist(from_dist[0], to_dist[0]), dist(from_dist[0], to_dist[1]),
                                    dist(from_dist[1], to_dist[0]), dist(from_dist[1], to_dist[1])
                                ]
                                let lowest_value = Infinity, lowest_index = 0;
                                dists.forEach((i, d) => {
                                    if (i < lowest_value) {
                                        lowest_value = i
                                        lowest_index = d
                                    }
                                })
                                let using_from: T.DD = 0, using_to: T.DD = 0;
                                if (lowest_index == 0) {
                                    using_to = to_dist[0]
                                    using_from = from_dist[0]
                                }
                                if (lowest_index == 1) {
                                    using_to = to_dist[1]
                                    using_from = from_dist[0]
                                }
                                if (lowest_index == 2) {
                                    using_to = to_dist[0]
                                    using_from = from_dist[1]
                                }
                                if (lowest_index == 3) {
                                    using_to = to_dist[1]
                                    using_from = from_dist[1]
                                }
                                if (from_dist[0] > from_dist[1]) {
                                    if (using_from == from_dist[0]) {
                                        specific_from_door = hall_direction[1]
                                    } else specific_from_door = hall_direction[0]
                                } else {
                                    if (using_from == from_dist[1]) {
                                        specific_from_door = hall_direction[1]
                                    } else specific_from_door = hall_direction[0]
                                }
                                if (using_from == using_to) {
                                    from_to_parent_direction = "straight"
                                }
                                if (using_to > using_from) {
                                    from_to_parent_direction = from_to_parent_direction == "left" ? "right" : "left"
                                }
                            }
                            // from: 2, to: 2
                        }
                        // prob better way to do these, im lazy but if you do
                        // an alt make sure it is still O(1)
                        shortcuts.push({
                            from: d - 2,
                            to : d,
                            directions: [
                                from_to_parent_direction,
                                side, destination
                            ],
                            from_door: specific_from_door
                        })
                    }
                })
            }
            if (prev == null) {
                prev = i;
                return
            }
            steps.push(directions[`${prev},${i}`])
            prev = i
        })
        // if shortcuts, replace other instructions
        shortcuts.sort((a, b) => b.from - a.from)
        for (const short of shortcuts) {
            steps.splice(short.from, 2, `${short.from_door != false ? `Using the door closest to the ${short.from_door} g` : ` G`}o ${short.directions[0]} into the hallway and look for the room ${short.directions[2]} on the ${short.directions[1].replace(" side","")} side of the hall.`)
        }
        const seconds = (Date.now() - start) * 0.001;
        res
           .status(200)
           .send(JSON.stringify({
                path: ans,
                directions: steps,
                shorter: shortcuts,
                time: `Found path in ${seconds == 0 ? "under 0.001" : String(seconds).substring(0, 5)} second${seconds != 1 ? "s" : ""}, using O(e+v+p) 😎`
            }))
    }
})
app.listen(4000)