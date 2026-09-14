"use client"

import * as React from "react"
import { useEffect, useRef } from "react"

const MAX_DPR = 2
const TAU = Math.PI * 2

const PERIOD = 4.8
const BASE_SPREAD = 0.3
const PERSPECTIVE = 3.5
const DEPTH_SIZE = 1
const DEPTH_FADE = 1
const MIN_RADIUS = 0.6
const MAX_DOTS = 1024

function clamp01(x: number): number {
    return x < 0 ? 0 : x > 1 ? 1 : x
}

function dotsN(base: number, n: number): number {
    const v = Math.round(base * n)
    return v < 1 ? 1 : v
}

function bump(x: number): number {
    return 0.5 - 0.5 * Math.cos(TAU * clamp01(x))
}

function fib(i: number, n: number): [number, number, number] {
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const th = 2.399963 * i
    return [Math.cos(th) * r, y, Math.sin(th) * r]
}

function polar(p: [number, number, number]): [number, number] {
    return [Math.acos(Math.max(-1, Math.min(1, p[1]))), Math.atan2(p[2], p[0])]
}

type Dot = [number, number, number, number?, number?, string?]

function spin(p: Dot, yaw: number, pitch: number): Dot {
    const ca = Math.cos(yaw)
    const sa = Math.sin(yaw)
    const rx = p[0] * ca - p[2] * sa
    let rz = p[0] * sa + p[2] * ca
    const co = Math.cos(pitch)
    const so = Math.sin(pitch)
    const ry = p[1] * co - rz * so
    rz = p[1] * so + rz * co
    return [rx, ry, rz, p[3], p[4], p[5]]
}

type Params = {
    n: number
    sp: number
    ds: number
    yw: number
    sn: number
    pc: number
    t: number
    dot: string
    acc: string
}

function frame(t: number, P: Params, out: Dot[]) {
        const n = dotsN(150, P.n)

        const k = bump(t)
        for (let i = 0; i < n; i += 1) {
            const p = polar(fib(i, n))

            const th = p[0] + (Math.PI / 2 - p[0]) * k
            const sr = Math.sin(th)
            out.push(spin([Math.cos(p[1]) * sr, Math.cos(th), Math.sin(p[1]) * sr, 0.8 + 0.5 * k, 0.9], TAU * t, 0.4))
        }
}

type Emit = (x: number, y: number, r: number, a: number, col: string) => void

function project(pts: Dot[], size: number, P: Params, emit: Emit) {
    const c = size / 2
    const R = size * BASE_SPREAD * P.sp
    const pv = PERSPECTIVE

    const yaw = P.yw + TAU * P.sn * P.t
    const list: Array<[number, number, number, number, string, number]> = []
    for (const p of pts) {
        const q = spin(p, yaw, P.pc)
        const z = q[2]
        const s = pv / (pv - z)
        const f = clamp01((z + 1.1) / 2.2)
        list.push([
            c + q[0] * R * s,
            c + q[1] * R * s,
            P.ds * (0.4 + 1.6 * DEPTH_SIZE * f) * s * (q[3] === undefined ? 1 : q[3]),
            (0.07 + 0.93 * Math.pow(f, 1.55 * DEPTH_FADE)) * (q[4] === undefined ? 1 : q[4]),
            q[5] || P.dot,
            z,
        ])
    }
    list.sort((a, b) => a[5] - b[5])
    for (const d of list) emit(d[0], d[1], d[2], d[3], d[4])
}

const fitCache = new Map<string, number>()
function autoFit(size: number, P: Params, restYaw: number, restPitch: number): number {
    const key = size + "/" + P.n + "/" + P.sp + "/" + restYaw + "/" + restPitch + "/" + P.sn
    const hit = fitCache.get(key)
    if (hit !== undefined) return hit
    const half = size / 2
    let ext = 0
    const probe: Params = { ...P, ds: 1, dot: "#fff", acc: "#fff", t: 0, yw: restYaw, pc: restPitch }
    const emit: Emit = (x, y, r, a) => {
        if (a <= 0.05 || r <= 0.15) return
        ext = Math.max(ext, Math.abs(x - half) + 0.5 * r, Math.abs(y - half) + 0.5 * r)
    }
    for (let k = 0; k < 20; k += 1) {
        probe.t = k / 20
        const out: Dot[] = []
        frame(probe.t, probe, out)
        project(out, size, probe, emit)
    }
    const fit = ext > 1 ? Math.max(0.55, Math.min(1.7, (0.415 * size) / ext)) : 1
    fitCache.set(key, fit)
    return fit
}

function dotScaleFor(size: number): number {
    if (size <= 46) return 0.4
    if (size <= 190) return 0.4 + ((size - 46) / 144) * 0.6
    if (size <= 340) return 1 + ((size - 190) / 150) * 0.55
    return 1.55
}

type RGBA = [number, number, number, number]

function parseColor(input: string | undefined, fb: RGBA): RGBA {
    if (!input) return fb
    const str = String(input).trim()
    if (str.charAt(0) === "#") {
        let hex = str.slice(1)
        if (hex.length === 3 || hex.length === 4) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + (hex.length === 4 ? hex[3] + hex[3] : "")
        }
        if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16)
            const g = parseInt(hex.slice(2, 4), 16)
            const b = parseInt(hex.slice(4, 6), 16)
            const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b, a]
        }
        return fb
    }
    const m = str.match(/[\d.]+/g)
    if (m && m.length >= 3) {
        return [
            Math.min(255, parseFloat(m[0])),
            Math.min(255, parseFloat(m[1])),
            Math.min(255, parseFloat(m[2])),
            m.length >= 4 ? Math.min(1, parseFloat(m[3])) : 1,
        ]
    }
    return fb
}

function css(c: RGBA): string {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + c[3] + ")"
}

function num(v: unknown, fb: number): number {
    return typeof v === "number" && isFinite(v) ? v : fb
}

function clampN(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
}

type Ball = { spread?: number; turn?: number; tilt?: number }
type Pointer = { drag?: number; damping?: number }
const BALL_DEFAULTS: Required<Ball> = { spread: 100, turn: 0, tilt: 0 }
const POINTER_DEFAULTS: Required<Pointer> = { drag: 100, damping: 20 }

interface Props {
    style?: React.CSSProperties
    width?: number
    height?: number
    dotColor?: string
    density?: number
    dotSize?: number
    speed?: number
    spinTurns?: number
    ball?: Ball
    pointer?: Pointer
}

export default function OrbConverge(props: Props) {
    const {
        style,
        dotColor = "#94FD00",
        density = 300,
        dotSize = 100,
        speed = 50,
        spinTurns = 1,
        ball,
        pointer,
        width,
        height,
    } = props

    const ball_ = { ...BALL_DEFAULTS, ...(ball || {}) }
    const pointer_ = { ...POINTER_DEFAULTS, ...(pointer || {}) }

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sizeRef = useRef({ w: 0, h: 0 })
    sizeRef.current = { w: num(width, 0), h: num(height, 0) }

    const vRef = useRef<Record<string, number | string>>({})
    vRef.current = {
        dot: dotColor,

        acc: dotColor,

        speed: clampN(num(speed, 50), -100, 100) / 50,
        density: clampN(num(density, 100), 20, 300) / 100,
        dotSize: clampN(num(dotSize, 100), 20, 300) / 100,
        spinTurns: Math.round(clampN(num(spinTurns, 1), -3, 3)),
        drag: clampN(num(pointer_.drag, 100), 0, 300) / 100,
        damping: clampN(num(pointer_.damping, 20), 1, 100),
        spread: clampN(num(ball_.spread, 100), 40, 180) / 100,
        turn: (clampN(num(ball_.turn, 0), -180, 180) * Math.PI) / 180,
        tilt: (clampN(num(ball_.tilt, 0), -90, 90) * Math.PI) / 180,
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            console.error("OrbConverge: 2D context unavailable")
            return
        }

        const drag = { active: false, lx: 0, ly: 0, lt: 0, yaw: 0, pitch: 0, vx: 0, vy: 0 }

        let raf = 0
        let last = performance.now()
        let phase = 0

        const render = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now
            const v = vRef.current

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
            const cw = sizeRef.current.w || canvas.clientWidth || 120
            const ch = sizeRef.current.h || canvas.clientHeight || 120
            const bw = Math.max(1, Math.round(cw * dpr))
            const bh = Math.max(1, Math.round(ch * dpr))
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw
                canvas.height = bh
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, cw, ch)

            phase = (phase + (dt * (v.speed as number)) / PERIOD) % 1
            if (phase < 0) phase += 1

            const size = Math.max(4, Math.min(cw, ch))
            const bx = (cw - size) / 2
            const by = (ch - size) / 2

            const dotCol = css(parseColor(v.dot as string, [244, 241, 234, 1]))
            const accCol = css(parseColor(v.acc as string, [244, 241, 234, 1]))

            if (!drag.active) {
                const decay = Math.exp(-(v.damping as number) * 0.12 * dt)
                drag.yaw += drag.vx * dt
                drag.pitch += drag.vy * dt
                drag.vx *= decay
                drag.vy *= decay
            }
            const restPitch = v.tilt as number

            drag.pitch = clampN(drag.pitch, -Math.PI / 2 - restPitch, Math.PI / 2 - restPitch)

            const P: Params = {
                n: v.density as number,
                sp: v.spread as number,
                ds: dotScaleFor(size) * (v.dotSize as number),
                yw: (v.turn as number) + drag.yaw,
                sn: v.spinTurns as number,
                pc: restPitch + drag.pitch,
                t: phase,
                dot: dotCol,
                acc: accCol,
            }

            const fit = autoFit(size, P, v.turn as number, restPitch)
            const half = size / 2

            const out: Dot[] = []
            frame(phase, P, out)
            let drawn = 0
            project(out, size, P, (x, y, r, a, col) => {
                if (drawn >= MAX_DOTS) return

                const rr = r * (0.55 + 0.45 * fit)
                if (rr <= 0.05 || a <= 0.004) return
                const cx = bx + half + (x - half) * fit
                const cy = by + half + (y - half) * fit

                let dr = rr
                let da = Math.min(1, a)
                if (dr < MIN_RADIUS) {
                    da *= (dr / MIN_RADIUS) * (dr / MIN_RADIUS)
                    dr = MIN_RADIUS
                }
                ctx.globalAlpha = da
                ctx.fillStyle = col
                ctx.beginPath()
                ctx.arc(cx, cy, dr, 0, TAU)
                ctx.fill()
                drawn += 1
            })
            ctx.globalAlpha = 1

            raf = requestAnimationFrame(render)
        }

        const onDown = (e: PointerEvent) => {
            if ((vRef.current.drag as number) <= 0) return
            drag.active = true
            drag.lx = e.clientX
            drag.ly = e.clientY
            drag.lt = performance.now()
            drag.vx = 0
            drag.vy = 0
            try {
                canvas.setPointerCapture(e.pointerId)
            } catch (err) {}
        }
        const onMove = (e: PointerEvent) => {
            if (!drag.active) return

            const k = (((vRef.current.drag as number) * TAU) / Math.max(1, canvas.clientWidth || 120))
            const dx = (e.clientX - drag.lx) * k
            const dy = (e.clientY - drag.ly) * k
            const now2 = performance.now()
            const span = Math.max(1, now2 - drag.lt)
            drag.lx = e.clientX
            drag.ly = e.clientY
            drag.lt = now2

            drag.yaw -= dx
            drag.pitch += dy
            drag.vx = (-dx / span) * 1000
            drag.vy = (dy / span) * 1000
        }

        const onUp = () => {
            drag.active = false
        }

        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)

        raf = requestAnimationFrame(render)
        return () => {
            cancelAnimationFrame(raf)
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
    }, [])

    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",

                minWidth: 24,
                minHeight: 24,
                width: typeof width === "number" && width > 0 ? width : "100%",
                height: typeof height === "number" && height > 0 ? height : "100%",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",

                    touchAction: "none",
                }}
            />
        </div>
    )
}