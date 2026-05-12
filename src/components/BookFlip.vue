<template>
  <div class="turn-book-wrap">
    <div ref="bookRef" class="turn-book"></div>
    <div class="nav-bar">
      <button class="nav-btn" :disabled="currentPage <= 0" @click="prevPage()">‹</button>
      <span class="pg-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
      <button class="nav-btn" :disabled="currentPage + 1 >= props.pages.length" @click="nextPage()">›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  pages: Array<{ title?: string; content?: string }>
  currentPage?: number
}>(), { pages: () => [], currentPage: 0 })

const emit = defineEmits(['update:currentPage', 'flip'])

const PI = Math.PI
const A90 = PI / 2
const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window
const events = isTouchDevice
  ? { start: 'touchstart', move: 'touchmove', end: 'touchend' }
  : { start: 'mousedown', move: 'mousemove', end: 'mouseup' }

const cornersDef = {
  backward: ['bl', 'tl'] as const,
  forward: ['br', 'tr'] as const,
  all: ['tl', 'bl', 'tr', 'br'] as const,
}
let activeCorners = { ...cornersDef }
const displays = ['single', 'double']
const pagesInDOM = 6
const CORNER_SIZE = 100

const pagePosition: Record<number, Record<string, string | number>> = {
  0: { top: 0, left: 0, right: 'auto', bottom: 'auto' },
  1: { top: 0, right: 0, left: 'auto', bottom: 'auto' },
}

interface Pt { x: number; y: number }
interface PageOpts {
  page: number
  next: number
  turn: HTMLElement
  duration: number
  acceleration: boolean
  corners: string | readonly string[]
  backGradient: boolean
  frontGradient: boolean
  zIndex?: number
  force?: boolean
  elevation?: number
}

interface FlipData {
  opts: PageOpts
  parent: HTMLElement
  fparent: HTMLElement | null
  wrapper: HTMLElement | null
  fwrapper: HTMLElement | null
  fpage: HTMLElement | null
  finner: HTMLElement | null
  ashadow: HTMLElement | null
  bshadow: HTMLElement | null
  point: (Pt & { corner?: string }) | null
  corner: (Pt & { corner?: string }) | null
  disabled?: boolean
  backParent?: HTMLElement | null
  time?: number
  folding?: number | null
  turning?: boolean
}

interface BookData {
  opts: { width: number; height: number; display: string; duration: number; gradients: boolean; acceleration: boolean; page: number; elevation?: number }
  pageObjs: Record<number, HTMLElement>
  pages: Record<number, HTMLElement>
  pageWrap: Record<number, HTMLElement>
  pagePlace: Record<number, number>
  pageMv: number[]
  totalPages: number
  display: string
  done: boolean
  disabled: boolean
  tpage: number | null
  fparent: HTMLElement | null
  shadow: HTMLElement | null
}

function point2D(x: number, y: number): Pt { return { x, y } }
function rad(degrees: number): number { return degrees / 180 * PI }
function deg(radians: number): number { return radians / PI * 180 }
function has(prop: string, obj: object): boolean { return Object.prototype.hasOwnProperty.call(obj, prop) }

const has3d = typeof CSS !== 'undefined' && 'WebKitCSSMatrix' in window || typeof document !== 'undefined' && 'MozPerspective' in document.body.style

function translate(x: number, y: number, use3d = false): string {
  return (has3d && use3d) ? ` translate3d(${x}px,${y}px,0px) ` : ` translate(${x}px,${y}px) `
}
function rotate(degrees: number): string { return ` rotate(${degrees}deg) ` }

function setTransform(el: HTMLElement, transform: string, origin?: string) {
  const prefix = ''
  const properties: Record<string, string> = {}
  if (origin) properties[`${prefix}transform-origin`] = origin
  properties[`${prefix}transform`] = transform
  Object.assign(el.style, properties)
}

function divAtt(top: number | string, left: number | string, zIndex?: number | string, overf?: string): Partial<CSSStyleDeclaration> {
  return {
    position: 'absolute',
    top: typeof top === 'number' ? `${top}px` : String(top),
    left: typeof left === 'number' ? `${left}px` : String(left),
    overflow: overf || 'hidden',
    zIndex: zIndex !== undefined ? String(zIndex) : 'auto',
  }
}

function bezier(p1: Pt, p2: Pt, p3: Pt, p4: Pt, t: number): Pt {
  const mum1 = 1 - t
  const mum13 = mum1 * mum1 * mum1
  const mu3 = t * t * t
  return point2D(
    Math.round(mum13 * p1.x + 3 * t * mum1 * mum1 * p2.x + 3 * t * t * mum1 * p3.x + mu3 * p4.x),
    Math.round(mum13 * p1.y + 3 * t * mum1 * mum1 * p2.y + 3 * t * t * mum1 * p3.y + mu3 * p4.y),
  )
}

const vendorPrefixes = ['Moz', 'Webkit', 'Khtml', 'O', 'ms']
let vendor = ''
for (let i = vendorPrefixes.length - 1; i >= 0; i--) {
  if ((vendorPrefixes[i] + 'Transform') in document.body.style) {
    vendor = '-' + vendorPrefixes[i].toLowerCase() + '-'
    break
  }
}

function gradient(obj: HTMLElement, p0: Pt, p1: Pt, colors: [number, string][], numColors: number) {
  const cols: string[] = []
  let j: number

  if (vendor === '-webkit-') {
    for (j = 0; j < numColors; j++)
      cols.push(`color-stop(${colors[j][0]}, ${colors[j][1]})`)
    obj.style.backgroundImage = `${vendor}gradient(linear, ${p0.x}% ${p0.y}%, ${p1.x}% ${p1.y}%, ${cols.join(',')})`
  } else {
    const w = obj.offsetWidth || 1
    const h = obj.offsetHeight || 1
    const p0x = (p0.x / 100) * w
    const p0y = (p0.y / 100) * h
    const p1x = (p1.x / 100) * w
    const p1y = (p1.y / 100) * h
    const dx = p1x - p0x
    const dy = p1y - p0y
    const angle = Math.atan2(dy, dx)
    const angle2 = angle - Math.PI / 2
    const diagonal = Math.abs(w * Math.sin(angle2)) + Math.abs(h * Math.cos(angle2))
    const gradDiagonal = Math.sqrt(dy * dy + dx * dx)
    const corner = point2D((p1x < p0x) ? w : 0, (p1y < p0y) ? h : 0)
    const slope = Math.tan(angle)
    const inverse = -1 / slope
    const x = (inverse * corner.x - corner.y - slope * p0x + p0y) / (inverse - slope)
    const cPt = { x, y: inverse * x - inverse * corner.x + corner.y }
    const segA = Math.sqrt(Math.pow(cPt.x - p0x, 2) + Math.pow(cPt.y - p0y, 2))

    for (j = 0; j < numColors; j++)
      cols.push(` ${colors[j][1]} ${((segA + gradDiagonal * colors[j][0]) * 100 / gradDiagonal)}%`)

    obj.style.backgroundImage = `${vendor}linear-gradient(${(-angle)}rad,${cols.join(',')})`
  }
}

const bookRef = ref<HTMLElement>()
const currentPage = ref(props.currentPage)
const isMobile = ref(false)
const pw = ref(400)
const ph = ref(300)
const bookWidth = ref(800)
const bookHeight = ref(600)

const bookData: BookData = {
  opts: { width: 800, height: 600, display: 'double', duration: 600, gradients: true, acceleration: true, page: 1 },
  pageObjs: {},
  pages: {},
  pageWrap: {},
  pagePlace: {},
  pageMv: [],
  totalPages: 0,
  display: 'double',
  done: false,
  disabled: false,
  tpage: null,
  fparent: null,
  shadow: null,
}

const flipDataMap = new Map<number, FlipData>()

const isSinglePage = computed(() => false)
const totalPages = computed(() => props.pages.length)

function getView(pageNum?: number): number[] {
  const p = pageNum ?? bookData.page ?? currentPage.value + 1
  if (bookData.display === 'double')
    return (p % 2) ? [p - 1, p] : [p, p + 1]
  return [p]
}

function viewFn(pageNum?: number): number[] {
  const v = getView(pageNum)
  v[1] = v[1] || v[0]
  if (bookData.display === 'double') {
    return [(v[0] > 0) ? v[0] : 0, (v[1] <= bookData.totalPages) ? v[1] : 0]
  }
  return [(v[0] > 0 && v[0] <= bookData.totalPages) ? v[0] : 0]
}

function rangeFn(pageNum?: number): number[] {
  let remainingPages: number, left: number, right: number
  const p = pageNum ?? bookData.tpage ?? bookData.page ?? currentPage.value + 1
  const view = getView(p)
  if (p < 1 || p > bookData.totalPages) throw new Error(`"${p}" is not a page for range`)
  view[1] = view[1] || view[0]

  if (view[0] >= 1 && view[1] <= bookData.totalPages) {
    remainingPages = Math.floor((pagesInDOM - 2) / 2)
    if (bookData.totalPages - view[1] > view[0]) {
      left = Math.min(view[0] - 1, remainingPages)
      right = 2 * remainingPages - left
    } else {
      right = Math.min(bookData.totalPages - view[1], remainingPages)
      left = 2 * remainingPages - right
    }
  } else {
    left = pagesInDOM - 1
    right = pagesInDOM - 1
  }
  return [Math.max(1, view[0] - left), Math.min(bookData.totalPages, view[1] + right)]
}

function necessPage(pageNum: number): boolean {
  if (pageNum === 0) return true
  const r = rangeFn()
  return pageNum >= r[0] && pageNum <= r[1]
}

function setPageLoc(pageNum: number): number {
  const v = viewFn()
  if (pageNum === v[0] || pageNum === v[1]) {
    if (bookData.pageWrap[pageNum]) {
      Object.assign(bookData.pageWrap[pageNum].style, { zIndex: bookData.totalPages, display: '' })
    }
    return 1
  } else if ((bookData.display === 'single' && pageNum === v[0] + 1) ||
             (bookData.display === 'double' && (pageNum === v[0] - 2 || pageNum === v[1] + 2))) {
    if (bookData.pageWrap[pageNum]) {
      Object.assign(bookData.pageWrap[pageNum].style, { zIndex: bookData.totalPages - 1, display: '' })
    }
    return 2
  } else {
    if (bookData.pageWrap[pageNum]) {
      Object.assign(bookData.pageWrap[pageNum].style, { zIndex: 0, display: 'none' })
    }
    return 0
  }
}

function _cAllowed(flipData: FlipData): readonly string[] {
  return (activeCorners[flipData.opts.corners as keyof typeof activeCorners] as readonly string[]) || flipData.opts.corners as readonly string[]
}

function _cornerActivated(flipEl: HTMLElement, e: MouseEvent | Touch): (Pt & { corner: string }) | null {
  const fd = flipDataMap.get(parseInt(flipEl.getAttribute('data-flip-id') || '0'))
  if (!fd) return null
  const pos = fd.parent.getBoundingClientRect()
  const width = flipEl.offsetWidth
  const height = flipEl.offsetHeight
  const touchX = 'clientX' in e ? e.clientX : e.clientX
  const touchY = 'clientY' in e ? e.clientY : e.clientY
  const c: Pt & { corner?: string } = {
    x: Math.max(0, touchX - pos.left),
    y: Math.max(0, touchY - pos.top),
  }
  const csz = fd.opts.cornerSize ?? CORNER_SIZE
  if (c.x <= 0 || c.y <= 0 || c.x >= width || c.y >= height) return null
  if (c.y < csz) c.corner = 't'
  else if (c.y >= height - csz) c.corner = 'b'
  else return null
  if (c.x <= csz) c.corner += 'l'
  else if (c.x >= width - csz) c.corner += 'r'
  else return null
  const allowed = _cAllowed(fd)
  if (allowed.indexOf(c.corner!) === -1) return null
  return c as Pt & { corner: string }
}

function _c(corner: string, opts: number, w: number, h: number): Pt {
  const map: Record<string, Pt> = {
    tl: point2D(opts, opts),
    tr: point2D(w - opts, opts),
    bl: point2D(opts, h - opts),
    br: point2D(w - opts, h - opts),
  }
  return map[corner]
}

function _c2(corner: string, w: number, h: number): Pt {
  const map: Record<string, Pt> = {
    tl: point2D(w * 2, 0),
    tr: point2D(-w, 0),
    bl: point2D(w * 2, h),
    br: point2D(-w, h),
  }
  return map[corner]
}

function _foldingPage(fd: FlipData): HTMLElement | null {
  if (fd.opts.folding) return fd.opts.folding as unknown as HTMLElement
  const next = fd.opts.next
  if (bookData.display === 'single')
    return (bookData.pageObjs[next]) ? bookData.pageObjs[0] || null : null
  return bookData.pageObjs[next] || bookRef.value?.querySelector(`.turn-page.p${next}`) || null
}

function _backGradient(fd: FlipData, el: HTMLElement): boolean {
  const g = fd.opts.backGradient &&
    (!fd.opts.turn || bookData.display === 'single' || (fd.opts.page !== 2 && fd.opts.page !== bookData.totalPages - 1))
  if (g && !fd.bshadow) {
    fd.bshadow = document.createElement('div')
    Object.assign(fd.bshadow.style, divAtt(0, 0, 1), { position: '', width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` })
    fd.parent.appendChild(fd.bshadow)
  }
  return g
}

function _addPageWrapper(flipEl: HTMLElement, fd: FlipData) {
  if (fd.wrapper) return
  const width = flipEl.offsetWidth
  const height = flipEl.offsetHeight
  const size = Math.round(Math.sqrt(width ** 2 + height ** 2))

  fd.parent = flipEl.parentElement!
  fd.fparent = bookData.fparent

  for (let i = fd.parent.children.length - 1; i >= 0; i--) {
    const c = fd.parent.children[i] as HTMLElement
    if (c !== flipEl && !c.contains(flipEl)) {
      c.remove()
    }
  }

  if (!fd.fparent) {
    const fp = document.createElement('div')
    Object.assign(fp.style, {
      pointerEvents: 'none',
      position: 'absolute',
      top: '0px',
      left: '0px',
      overflow: 'visible',
    })
    fp.style.display = 'none'
    ;(fp as any).flips = 0
    fd.opts.turn.appendChild(fp)
    bookData.fparent = fp
    fd.fparent = fp
  }

  Object.assign(flipEl.style, { position: 'absolute', top: 0, left: 0, bottom: 'auto', right: 'auto' })

  fd.wrapper = document.createElement('div')
  Object.assign(fd.wrapper.style, divAtt(0, 0, flipEl.style.zIndex || 'auto'))
  fd.parent.appendChild(fd.wrapper)
  fd.wrapper.insertBefore(flipEl, fd.wrapper.firstChild)

  fd.fwrapper = document.createElement('div')
  Object.assign(fd.fwrapper.style, divAtt(fd.parent.offsetTop, fd.parent.offsetLeft))
  fd.fwrapper.style.display = 'none'
  fd.fparent!.appendChild(fd.fwrapper)

  fd.finner = document.createElement('div')
  Object.assign(fd.finner.style, divAtt(0, 0, 0, 'visible'))
  fd.fwrapper.appendChild(fd.finner)

  fd.fpage = document.createElement('div')
  Object.assign(fd.fpage.style, { cursor: 'default' })
  fd.finner.appendChild(fd.fpage)

  if (fd.opts.frontGradient) {
    fd.ashadow = document.createElement('div')
    Object.assign(fd.ashadow.style, divAtt(0, 0, 1))
    fd.fpage.appendChild(fd.ashadow)
  }

  resizeFlip(flipEl, fd, true)
}

function resizeFlip(flipEl: HTMLElement, fd: FlipData, full?: boolean) {
  const width = flipEl.offsetWidth
  const height = flipEl.offsetHeight
  const size = Math.round(Math.sqrt(width ** 2 + height ** 2))

  if (full) {
    if (fd.wrapper) {
      fd.wrapper.style.width = `${size}px`
      fd.wrapper.style.height = `${size}px`
    }
    if (fd.fwrapper) {
      fd.fwrapper.style.width = `${size}px`
      fd.fwrapper.style.height = `${size}px`
    }
    if (fd.finner) {
      fd.finner.style.width = `${width}px`
      fd.finner.style.height = `${height}px`
    }
    if (fd.fpage) {
      fd.fpage.style.width = `${height}px`
      fd.fpage.style.height = `${width}px`
    }
    if (fd.opts.frontGradient && fd.ashadow) {
      fd.ashadow.style.width = `${height}px`
      fd.ashadow.style.height = `${width}px`
    }
    if (_backGradient(fd, flipEl) && fd.bshadow) {
      fd.bshadow.style.width = `${width}px`
      fd.bshadow.style.height = `${height}px`
    }
  }

  if (fd.parent && fd.parent.offsetParent !== null) {
    const turnRect = fd.opts.turn.getBoundingClientRect()
    const parentRect = fd.parent.getBoundingClientRect()
    if (fd.fwrapper) {
      fd.fwrapper.style.top = `${parentRect.top - turnRect.top}px`
      fd.fwrapper.style.left = `${parentRect.left - turnRect.left}px`
    }
  }

  if (fd.wrapper && fd.fwrapper) {
    const z = fd.opts['z-index']
    fd.wrapper.style.zIndex = String(z || parseInt(fd.parent.style.zIndex || '0', 10) || 0)
  }
}

function _fold(flipEl: HTMLElement, fd: FlipData, point: Pt & { corner: string }) {
  const that = flipEl
  let a = 0
  let alpha = 0
  let mv = point2D(0, 0)
  let df = point2D(0, 0)
  let tr = point2D(0, 0)
  const width = that.offsetWidth
  const height = that.offsetHeight
  const folding = _foldingPage(fd)
  const data = fd
  const ac = data.opts.acceleration
  const h = data.wrapper ? data.wrapper.offsetHeight : height
  const o = _c(point.corner, 0, width, height)
  const top = point.corner.charAt(0) === 't'
  const left = point.corner.charAt(1) === 'l'
  let gradientSize = 0
  let gradientOpacity = 1
  let shadowOpacity = 0
  let gradientStartV = 0
  let gradientEndPointA = point2D(0, 0)
  let gradientEndPointB = point2D(0, 0)

  function compute(): boolean {
    const rel = point2D((o.x) ? o.x - point.x : point.x, (o.y) ? o.y - point.y : point.y)
    const tanV = Math.atan2(rel.y, rel.x)
    alpha = A90 - tanV
    a = deg(alpha)
    const middle = point2D((left) ? width - rel.x / 2 : point.x + rel.x / 2, rel.y / 2)
    const gamma = alpha - Math.atan2(middle.y, middle.x)
    const distance = Math.max(0, Math.sin(gamma) * Math.sqrt(middle.x ** 2 + middle.y ** 2))
    tr = point2D(distance * Math.sin(alpha), distance * Math.cos(alpha))

    if (alpha > A90) {
      tr.x = tr.x + Math.abs(tr.y * Math.tan(tanV))
      tr.y = 0
      if (Math.round(tr.x * Math.tan(PI - alpha)) < height) {
        point.y = Math.sqrt(height ** 2 + 2 * middle.x * rel.x)
        if (top) point.y = height - point.y
        return compute()
      }
    }

    if (alpha > A90) {
      const beta = PI - alpha
      const dd = h - height / Math.sin(beta)
      mv.x = Math.round(dd * Math.cos(beta))
      mv.y = Math.round(dd * Math.sin(beta))
      if (left) mv.x = -mv.x
      if (top) mv.y = -mv.y
    }

    const px = Math.round(tr.y / Math.tan(alpha) + tr.x)
    const side = width - px
    const sideX = side * Math.cos(alpha * 2)
    const sideY = side * Math.sin(alpha * 2)
    df = point2D(Math.round((left ? side - sideX : px + sideX)), Math.round((top) ? sideY : height - sideY))

    gradientSize = side * Math.sin(alpha)
    const endingPoint = _c2(point.corner, width, height)
    const far = Math.sqrt((endingPoint.x - point.x) ** 2 + (endingPoint.y - point.y) ** 2)
    const farRatio = far / width
    gradientOpacity = Math.min(farRatio, 1)
    shadowOpacity = Math.sin(A90 * (farRatio > 1 ? 2 - farRatio : farRatio))

    if (data.opts.frontGradient) {
      gradientStartV = gradientSize > 100 ? (gradientSize - 100) / gradientSize : 0
      gradientEndPointA = point2D(
        gradientSize * Math.sin(A90 - alpha) / height * 100,
        gradientSize * Math.cos(A90 - alpha) / width * 100,
      )
      if (top) gradientEndPointA.y = 100 - gradientEndPointA.y
      if (left) gradientEndPointA.x = 100 - gradientEndPointA.x
    }

    if (_backGradient(data, that)) {
      gradientEndPointB = point2D(
        gradientSize * Math.sin(alpha) / width * 100,
        gradientSize * Math.cos(alpha) / height * 100,
      )
      if (!left) gradientEndPointB.x = 100 - gradientEndPointB.x
      if (!top) gradientEndPointB.y = 100 - gradientEndPointB.y
    }

    return true
  }

  compute()

  function doTransform(trVal: Pt, cArr: (0 | 1)[], xArr: (0 | 100)[], angle: number) {
    const f = ['0', 'auto']
    const mvW = (width - h) * xArr[0] / 100
    const mvH = (height - h) * xArr[1] / 100
    const v = { left: f[cArr[0]], top: f[cArr[1]], right: f[cArr[2]], bottom: f[cArr[3]] }
    const aliasingFk = (angle !== 90 && angle !== -90) ? (left ? -1 : 1) : 0
    const origStr = xArr[0] + '% ' + xArr[1] + '%'

    Object.assign(that.style, { left: v.left, top: v.top, right: v.right, bottom: v.bottom })
    setTransform(that, rotate(angle) + translate(trVal.x + aliasingFk, trVal.y, ac), origStr)

    const folding = _foldingPage(fd)
    if (folding) {
      folding.style.boxShadow = `0 0 20px rgba(0,0,0,${0.5 * shadowOpacity})`
    }

    if (data.fpage && data.fpage.parentElement) {
      const fparentEl = data.fpage.parentElement as HTMLElement
      Object.assign(fparentEl.style, { left: v.left, top: v.top, right: v.right, bottom: v.bottom })
      setTransform(fparentEl, rotate(angle) + translate(trVal.x + df.x - mv.x, trVal.y + df.y - mv.y, ac), origStr)
    }

    if (data.wrapper) {
      setTransform(data.wrapper, translate(-trVal.x + mvW - aliasingFk, -trVal.y + mvH, ac) + rotate(-angle), origStr)
    }

    if (data.fwrapper) {
      setTransform(data.fwrapper, translate(-trVal.x + mv.x + mvW, -trVal.y + mv.y + mvH, ac) + rotate(-angle), origStr)
    }

    if (data.opts.frontGradient && data.ashadow) {
      gradient(data.ashadow, point2D(left ? 100 : 0, top ? 100 : 0), point2D(gradientEndPointA.x, gradientEndPointA.y), [
        [gradientStartV, 'rgba(0,0,0,0)'],
        [((1 - gradientStartV) * 0.8) + gradientStartV, `rgba(0,0,0,${0.2 * gradientOpacity})`],
        [1, `rgba(255,255,255,${0.2 * gradientOpacity})`],
      ], 3)
    }

    if (_backGradient(data, that) && data.bshadow) {
      gradient(data.bshadow, point2D(left ? 0 : 100, top ? 0 : 100), point2D(gradientEndPointB.x, gradientEndPointB.y), [
        [0.8, 'rgba(0,0,0,0)'],
        [1, `rgba(0,0,0,${0.3 * gradientOpacity})`],
        [1, 'rgba(0,0,0,0)'],
      ], 3)
    }
  }

  switch (point.corner) {
    case 'tl':
      point.x = Math.max(point.x, 1)
      doTransform(tr, [1, 0, 0, 1], [100, 0], a)
      if (data.fpage) setTransform(data.fpage, translate(-height, -width, ac) + rotate(90 - a * 2), '100% 100%')
      if (folding) setTransform(folding, rotate(90) + translate(0, -height, ac), '0% 0%')
      break
    case 'tr':
      point.x = Math.min(point.x, width - 1)
      doTransform(point2D(-tr.x, tr.y), [0, 0, 0, 1], [0, 0], -a)
      if (data.fpage) setTransform(data.fpage, translate(0, -width, ac) + rotate(-90 + a * 2), '0% 100%')
      if (folding) setTransform(folding, rotate(270) + translate(-width, 0, ac), '0% 0%')
      break
    case 'bl':
      point.x = Math.max(point.x, 1)
      doTransform(point2D(tr.x, -tr.y), [1, 1, 0, 0], [100, 100], -a)
      if (data.fpage) setTransform(data.fpage, translate(-height, 0, ac) + rotate(-90 + a * 2), '100% 0%')
      if (folding) setTransform(folding, rotate(270) + translate(-width, 0, ac), '0% 0%')
      break
    case 'br':
      point.x = Math.min(point.x, width - 1)
      doTransform(point2D(-tr.x, -tr.y), [0, 1, 1, 0], [0, 100], a)
      if (data.fpage) setTransform(data.fpage, rotate(90 - a * 2), '0% 0%')
      if (folding) setTransform(folding, rotate(90) + translate(0, -height, ac), '0% 0%')
      break
  }

  data.point = point
}

function _moveFoldingPage(flipEl: HTMLElement, fd: FlipData, bool: boolean) {
  const folding = _foldingPage(fd)
  if (!folding) return
  if (bool) {
    if (!fd.fpage || !fd.fpage.children[fd.ashadow ? 1 : 0] || fd.fpage.children[fd.ashadow ? 1 : 0] !== folding) {
      fd.backParent = folding.parentElement
      fd.fpage!.prepend(folding)
    }
  } else {
    let target = fd.backParent
    if (!target) {
      const cls = (folding.className || '') as string
      const m = cls.match(/p(\d+)/)
      const pageNum = m ? parseInt(m[1]) : fd.opts.next
      target = bookData.pageWrap[pageNum]
    }
    if (target) {
      folding.style.boxShadow = ''
      placeIntoWrapper(pageNumOf(folding), folding, target)
    }
  }
}

function placeIntoWrapper(pageNum: number, el: HTMLElement, fallbackTarget: HTMLElement) {
  const fd = flipDataMap.get(pageNum)
  if (fd && fd.wrapper && fd.wrapper.parentNode === fallbackTarget && fd.wrapper !== el) {
    fd.wrapper.prepend(el)
  } else {
    fallbackTarget.prepend(el)
  }
}

function pageNumOf(el: HTMLElement): number {
  const m = (el.className || '').match(/p(\d+)/)
  return m ? parseInt(m[1]) : 0
}

let animHandle: number | null = null
let animCompleteCb: (() => void) | null = null
let animTurning = false

function animatef(from: number | Pt[], to: number | Pt[], duration: number, frame: (v: number | number[]) => void, complete?: () => void) {
  if (!animTurning && animHandle !== null) cancelAnimationFrame(animHandle)
  if (typeof from === 'number' && typeof to === 'number') {
    const diff = to - from
    const startTime = performance.now()
    function tick(now: number) {
      const elapsed = now - startTime
      const t = Math.min(duration, elapsed)
      const eased = 1 - Math.pow(1 - t / duration, 3)
      frame(from + diff * eased)
      if (t >= duration) {
        animHandle = null
        if (complete) complete()
        return
      }
      animHandle = requestAnimationFrame(tick)
    }
    animHandle = requestAnimationFrame(tick)
    animCompleteCb = complete || null
  } else if (Array.isArray(from) && Array.isArray(to)) {
    const fromArr = from as number[]
    const toArr = to as number[]
    const diffs = toArr.map((v, i) => v - fromArr[i])
    const startTime = performance.now()
    function tick(now: number) {
      const elapsed = now - startTime
      const t = Math.min(duration, elapsed)
      const eased = 1 - Math.pow(1 - t / duration, 3)
      frame(fromArr.map((v, i) => v + diffs[i] * eased))
      if (t >= duration) {
        animHandle = null
        if (complete) complete()
        return
      }
      animHandle = requestAnimationFrame(tick)
    }
    animHandle = requestAnimationFrame(tick)
    animCompleteCb = complete || null
  }
}

function _showFoldedPage(flipEl: HTMLElement, fd: FlipData, c: Pt & { corner: string }, doAnimate?: boolean) {
  const folding = _foldingPage(fd)
  if (!fd.point || fd.point.corner !== c.corner) {
    _start(flipEl, fd, c.corner)
  }

  if (folding) {
    if (doAnimate) {
      const point = (fd.point && fd.point.corner === c.corner) ? fd.point : _c(c.corner, 1, flipEl.offsetWidth, flipEl.offsetHeight)
      animatef([point.x, point.y], [c.x, c.y], 500, (v) => {
        c.x = Math.round((v as number[])[0])
        c.y = Math.round((v as number[])[1])
        _fold(flipEl, fd, c)
      })
    } else {
      _fold(flipEl, fd, c)
    }

    if (fd.fwrapper && fd.fwrapper.style.display === 'none') {
      if (fd.fparent) {
        fd.fparent.style.display = ''
        const fparentAny = fd.fparent as any
        fparentAny.flips = (fparentAny.flips || 0) + 1
      }
      _moveFoldingPage(flipEl, fd, true)
      fd.fwrapper.style.display = ''
      if (fd.bshadow) fd.bshadow.style.display = ''
    }
    return true
  }
  return false
}

function hideFoldedPage(flipEl: HTMLElement, fd: FlipData, doAnimate?: boolean) {
  if (!fd.point) return
  const p1 = { ...fd.point } as Pt & { corner: string }
  const hide = () => {
    fd.point = null
    hideFlip(flipEl, fd)
    _end(flipEl, fd, false)
  }

  if (doAnimate) {
    const p4 = _c(p1.corner, 0, flipEl.offsetWidth, flipEl.offsetHeight)
    const top_ = (p1.corner.charAt(0) === 't')
    const delta = (top_) ? Math.min(0, p1.y - p4.y) / 2 : Math.max(0, p1.y - p4.y) / 2
    const p2 = point2D(p1.x, p1.y + delta)
    const p3 = point2D(p4.x, p4.y - delta)
    animatef(0, 1, 400, (v) => {
      const np = bezier(p1, p2, p3, p4, v as number)
      p1.x = np.x
      p1.y = np.y
      _fold(flipEl, fd, p1 as Pt & { corner: string })
    }, hide)
  } else {
    hide()
  }
}

function hideFlip(flipEl: HTMLElement, fd: FlipData) {
  _moveFoldingPage(flipEl, fd, false)
  if (fd.fparent) {
    ;(fd.fparent as any).flips = ((fd.fparent as any).flips || 0) - 1
    if ((fd.fparent as any).flips <= 0) fd.fparent.style.display = 'none'
  }
  flipEl.style.left = '0'
  flipEl.style.top = '0'
  flipEl.style.right = 'auto'
  flipEl.style.bottom = 'auto'
  setTransform(flipEl, '', '0% 100%')
  if (fd.wrapper) setTransform(fd.wrapper, '', '0% 100%')
  if (fd.fwrapper) fd.fwrapper.style.display = 'none'
  if (fd.bshadow) fd.bshadow.style.display = 'none'
  const folding = _foldingPage(fd)
  if (folding) setTransform(folding, '', '0% 0%')
}

function turnPageAnim(flipEl: HTMLElement, fd: FlipData, corner?: string) {
  corner = corner || (fd.corner ? fd.corner.corner : (_cAllowed(fd)[0]))
  const c: Pt & { corner: string } = { corner, x: 0, y: 0 }
  const elev = (fd.opts.turn && bookData.opts.elevation) ? bookData.opts.elevation : 0
  const ew = flipEl.offsetWidth || pw.value
  const eh = flipEl.offsetHeight || ph.value
  const p1 = fd.point || _c(corner, elev, ew, eh)
  const p4 = _c2(corner, ew, eh)

  emit('flip', fd.opts.next)
  fd.turning = true
  animTurning = true

  animatef(0, 1, fd.opts.duration, (v) => {
    const np = bezier(p1, p1, p4, p4, v as number)
    c.x = np.x
    c.y = np.y
    _showFoldedPage(flipEl, fd, c)
  }, () => {
    animTurning = false
    handleTurnEnd(flipEl, fd)
  })

  fd.corner = null
}

function handleTurnEnd(flipEl: HTMLElement, fd: FlipData) {
  fd.turning = false
  _end(flipEl, fd, true)
}

function fitPage(pageNum: number, ok?: boolean) {
  if (pageNum > 0 && pageNum <= bookData.totalPages) {
    if (!bookData.pageObjs[pageNum]) {
      return
    }

    bookData.tpage = pageNum
    stopTurn(ok)
    removeFromDOM()
    makeRange()
    if (bookData.fparent) {
      const fp = bookData.fparent

      // 🆕 强制隐藏所有残留的 fwrapper（防止任何 fd 的 fwrapper 未被清理）
      const allFwrappers = fp.querySelectorAll(':scope > .fwrapper')
      for (let i = 0; i < allFwrappers.length; i++) {
        (allFwrappers[i] as HTMLElement).style.display = 'none'
      }

      // 安全网第一层：扫描 fparent 回收卡住的 .turn-page
      const pages = fp.querySelectorAll('.turn-page')
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i] as HTMLElement
        const m = (pg.className || '').match(/p(\d+)/)
        if (m) {
          const num = parseInt(m[1])
          const wrapper = bookData.pageWrap[num]
          if (wrapper && !wrapper.contains(pg)) {
            pg.style.boxShadow = ''
            placeIntoWrapper(num, pg, wrapper)
          }
        }
      }
    }
    for (let pn = 1; pn <= bookData.totalPages; pn++) {
      const po = bookData.pageObjs[pn]
      if (!po) continue
      const wrap = bookData.pageWrap[pn]
      if (!wrap || wrap.contains(po)) continue
      po.style.boxShadow = ''
      placeIntoWrapper(pn, po, wrap)
    }
    updateDisplay()
  }
  currentPage.value = Math.max(0, (bookData.page || 1) - 1)
  emit('update:currentPage', currentPage.value)
}

function _turnPage(pageNum: number) {
  const curView = viewFn()
  const newView = viewFn(pageNum)
  const curPage = bookData.page || (currentPage.value + 1)

  if (curPage !== pageNum) {
    bookData.tpage = pageNum
    stopTurn()
    makeRange()

    let current: number, next: number
    if (bookData.display === 'single') {
      current = curView[0]
      next = newView[0]
    } else if (curView[1] && pageNum > curView[1]) {
      current = curView[1]
      next = newView[0]
    } else if (curView[0] && pageNum < curView[0]) {
      current = curView[0]
      next = newView[1]
    } else {
      current = curView[0] || curView[1]
      next = newView[0] || newView[1]
    }

    if (bookData.pages[current]) {
      const fd = flipDataMap.get(current)
      if (fd) {
        const opts = fd.opts
        bookData.tpage = next
        if (opts.next !== next) {
          opts.next = next
          bookData.pagePlace[next] = opts.page
          opts.force = true
        }
        if (bookData.display === 'single') {
          const corner = (newView[0] > curView[0]) ? 'br' : 'bl'
          turnPageAnim(bookData.pages[current], fd, corner)
        } else {
          turnPageAnim(bookData.pages[current], fd)
        }
      }
    }
  }
}

function goToPage(pageNum: number) {
  pageNum = parseInt(String(pageNum), 10)
  if (pageNum > 0 && pageNum <= bookData.totalPages) {
    const cv = viewFn()
    const inView = cv.indexOf(pageNum) !== -1
    if (!bookData.done || inView) {
      fitPage(pageNum)
    } else {
      _turnPage(pageNum)
    }
  }
}

function nextPage() {
  const lastPageInView = getView().pop() || bookData.page
  goToPage(lastPageInView + 1)
}

function prevPage() {
  const firstPageInView = getView().shift() || bookData.page
  goToPage(firstPageInView - 1)
}

function stopTurn(ok?: boolean) {
  if (animHandle !== null) { cancelAnimationFrame(animHandle); animHandle = null }
  animTurning = false
  const pagesMoving = [...bookData.pageMv]
  bookData.pageMv = []

  if (bookData.tpage) {
    bookData.page = bookData.tpage
    bookData.tpage = null
  }

  for (const pg of pagesMoving) {
    const pageEl = bookData.pages[pg]
    if (!pageEl) continue
    const fd = flipDataMap.get(pg)
    if (fd) {
      fd.turning = false
      _moveFoldingPage(pageEl, fd, false)
      hideFoldedPage(pageEl, fd, false)
      hideFlip(pageEl, fd)
    }
    if (fd) {
      bookData.pagePlace[fd.opts.next] = fd.opts.next
      if (fd.opts.force) {
        fd.opts.next = (fd.opts.page % 2 === 0) ? fd.opts.page - 1 : fd.opts.page + 1
        delete fd.opts.force
      }
    }
  }
  updateDisplay()
  if (bookData.fparent) {
    ;(bookData.fparent as any).flips = 0
    bookData.fparent.style.display = 'none'
  }
}

function removeMv(pageNum: number): boolean {
  const idx = bookData.pageMv.indexOf(pageNum)
  if (idx !== -1) {
    bookData.pageMv.splice(idx, 1)
    return true
  }
  return false
}

function addMv(pageNum: number) {
  removeMv(pageNum)
  bookData.pageMv.push(pageNum)
}

function addToDom() {
  const book = bookRef.value
  if (!book) return
  for (let i = 0; i < props.pages.length; i++) {
    addPage(i + 1)
  }
}

function addPage(pageNum: number) {
  const lastPage = bookData.totalPages + 1
  let incPages = false
  if (pageNum) {
    if (pageNum === lastPage) {
      pageNum = lastPage
      incPages = true
    } else if (pageNum > lastPage) {
      return
    }
  } else {
    pageNum = lastPage
    incPages = true
  }

  if (pageNum >= 1 && pageNum <= lastPage) {
    if (bookData.done) stopTurn()

    if (bookData.pageObjs[pageNum]) movePages(pageNum, 1)

    if (incPages) bookData.totalPages = lastPage

    const el = document.createElement('div')
    el.className = `turn-page p${pageNum}${pageNum % 2 !== 0 ? ' odd' : ' even'}`
    const pg = props.pages[numToIdx(pageNum)]
    el.innerHTML = renderPageContent(pg, pageNum)
    bookData.pageObjs[pageNum] = el

    _addPage(pageNum)

    if (bookData.done) updateDisplay()

    removeFromDOM()
  }
}

function numToIdx(pageNum: number): number {
  return pageNum - 1
}

function renderPageContent(pg: { title?: string; content?: string } | undefined, pageNum: number): string {
  const title = pg?.title || `第 ${pageNum} 页`
  const body = pg?.content || `这是第 ${pageNum} 页的内容`
  return `<div style="width:100%;height:100%;padding:1.2rem 1.5rem;box-sizing:border-box;overflow:auto;">
    <h2 style="margin:0 0 .6rem;font-size:1.15rem;font-weight:700;color:#222;text-align:center;">${title}</h2>
    <div style="font-size:.88rem;line-height:1.75;color:#444;white-space:pre-wrap;">${body}</div>
    <span style="position:absolute;bottom:.6rem;left:50%;transform:translateX(-50%);font-size:.78rem;color:#999;">${pageNum}</span>
  </div>`
}

function _addPage(pageNum: number) {
  const element = bookData.pageObjs[pageNum]
  if (!element) return

  if (necessPage(pageNum)) {
    if (!bookData.pageWrap[pageNum]) {
      const pageW = (bookData.display === 'double') ? pw.value : pw.value
      const pageH = ph.value
      element.style.width = `${pageW}px`
      element.style.height = `${pageH}px`
      bookData.pagePlace[pageNum] = pageNum

      const wrap = document.createElement('div')
      wrap.className = 'turn-page-wrapper'
      wrap.setAttribute('page', String(pageNum))
      Object.assign(wrap.style, {
        position: 'absolute',
        overflow: 'hidden',
        width: `${pageW}px`,
        height: `${pageH}px`,
        ...pagePosition[(bookData.display === 'double') ? pageNum % 2 : 0],
      })
      bookData.pageWrap[pageNum] = wrap

      const book = bookRef.value
      if (book) book.appendChild(wrap)
      wrap.prepend(element)
    }

    const loc = setPageLoc(pageNum)
    if (!pageNum || loc === 1) {
      makeFlip(pageNum)
    }
  } else {
    bookData.pagePlace[pageNum] = 0
    if (bookData.pageObjs[pageNum] && bookData.pageObjs[pageNum].parentNode) {
      bookData.pageObjs[pageNum].remove()
    }
  }
}

function makeFlip(pageNum: number) {
  if (bookData.pages[pageNum] || !bookData.pagePlace[pageNum] || bookData.pagePlace[pageNum] !== pageNum) return

  const single = bookData.display === 'single'
  const even = pageNum % 2
  const element = bookData.pageObjs[pageNum]
  if (!element) return

  const pageW = single ? pw.value : pw.value
  element.style.width = `${pageW}px`
  element.style.height = `${ph.value}px`

  const nextPage = (single && pageNum === bookData.totalPages) ? pageNum - 1 : ((even || single) ? pageNum + 1 : pageNum - 1)
  const cornersCfg = (single) ? 'all' as const : ((even) ? 'forward' : 'backward')

  const fd: FlipData = {
    opts: {
      page: pageNum,
      next: nextPage,
      turn: bookRef.value!,
      duration: bookData.opts.duration,
      acceleration: bookData.opts.acceleration,
      corners: cornersCfg,
      backGradient: bookData.opts.gradients,
      frontGradient: bookData.opts.gradients,
      cornerSize: CORNER_SIZE,
    },
    parent: null!,
    fparent: null,
    wrapper: null,
    fwrapper: null,
    fpage: null,
    finner: null,
    ashadow: null,
    bshadow: null,
    point: null,
    corner: null,
  }

  if (bookData.pageWrap[pageNum] && element.parentElement !== bookData.pageWrap[pageNum]) {
    bookData.pageWrap[pageNum].prepend(element)
  }

  element.setAttribute('data-flip-id', String(pageNum))
  flipDataMap.set(pageNum, fd)
  _addPageWrapper(element, fd)
  bookData.pages[pageNum] = element
}

function makeRange() {
  const r = rangeFn()
  for (let page = r[0]; page <= r[1]; page++) {
    _addPage(page)
  }
}

function removeFromDOM() {
  for (const pg in bookData.pageWrap) {
    if (!has(pg, bookData.pageWrap)) continue
    const p = parseInt(pg)
    if (!necessPage(p)) removePageFromDOM(p)
  }
}

function removePageFromDOM(pageNum: number) {
  if (bookData.pageObjs[pageNum] && bookData.pageObjs[pageNum].parentNode) bookData.pageObjs[pageNum].remove()
  if (bookData.pageWrap[pageNum] && bookData.pageWrap[pageNum].parentNode) {
    const fd = flipDataMap.get(pageNum)
    if (fd) {
      if (fd.fwrapper && fd.fwrapper.parentNode) fd.fwrapper.remove()
      delete bookData.pages[pageNum]
    }
    bookData.pageWrap[pageNum].remove()
    delete bookData.pageWrap[pageNum]
  }
  delete bookData.pagePlace[pageNum]
  flipDataMap.delete(pageNum)
}

function movePages(from: number, change: number) {
  const single = bookData.display === 'single'

  function move(page: number) {
    const next = page + change
    const odd = next % 2
    if (bookData.pageObjs[page]) {
      bookData.pageObjs[next] = bookData.pageObjs[page]
      bookData.pageObjs[next].className = `turn-page p${next}`
    }
    if (bookData.pagePlace[page] && bookData.pageWrap[page]) {
      bookData.pagePlace[next] = next
      bookData.pageWrap[next] = bookData.pageWrap[page]
      const posKey = (single) ? 0 : odd
      Object.assign(bookData.pageWrap[next].style, pagePosition[posKey])
      bookData.pageWrap[next].setAttribute('page', String(next))
      if (bookData.pages[page]) {
        const oldFd = flipDataMap.get(page)
        if (oldFd) {
          oldFd.opts.page = next
          oldFd.opts.next = (single || odd) ? next + 1 : next - 1
          oldFd.opts.corners = (single) ? 'all' : ((odd) ? 'forward' : 'backward')
          flipDataMap.delete(page)
          flipDataMap.set(next, oldFd)
          bookData.pages[next] = bookData.pages[page]
          bookData.pages[next].setAttribute('data-flip-id', String(next))
          delete bookData.pages[page]
        }
      }
      if (change) {
        delete bookData.pages[page]
        delete bookData.pagePlace[page]
        delete bookData.pageObjs[page]
        delete bookData.pageWrap[page]
      }
    }
  }

  if (change > 0)
    for (let page = bookData.totalPages; page >= from; page--) move(page)
  else
    for (let page = from; page <= bookData.totalPages; page++) move(page)
}

function setDisplay(display?: string) {
  const cur = bookData.display
  if (display) {
    if (displays.indexOf(display) === -1) throw new Error(`"${display}" is not a value for display`)
    if (display === 'single') {
      if (!bookData.pageObjs[0]) {
        const temp = document.createElement('div')
        temp.className = 'turn-page p-temporal'
        temp.style.cssText = `width:${pw.value}px;height:${ph.value}px;`
        const book = bookRef.value
        if (book) {
          book.appendChild(temp)
        }
        bookData.pageObjs[0] = temp
      }
    } else {
      if (bookData.pageObjs[0]) {
        const book = bookRef.value
        if (book) book.style.overflow = ''
        if (bookData.pageObjs[0].parentNode) bookData.pageObjs[0].remove()
        delete bookData.pageObjs[0]
      }
    }
    bookData.display = display
    if (cur) {
      movePages(1, 0)
      setSize(bookWidth.value, bookHeight.value)
      updateDisplay()
    }
  } else {
    return cur
  }
}

function setSize(width: number, height: number) {
  const pageW = (bookData.display === 'double') ? width / 2 : width
  const book = bookRef.value
  if (book) {
    book.style.width = `${width}px`
    book.style.height = `${height}px`
  }
  if (bookData.pageObjs[0]) {
    bookData.pageObjs[0].style.width = `${pageW}px`
    bookData.pageObjs[0].style.height = `${height}px`
  }
  for (const pg in bookData.pageWrap) {
    if (!has(pg, bookData.pageWrap)) continue
    const p = parseInt(pg)
    if (bookData.pageObjs[p]) {
      bookData.pageObjs[p].style.width = `${pageW}px`
      bookData.pageObjs[p].style.height = `${height}px`
    }
    if (bookData.pageWrap[p]) {
      bookData.pageWrap[p].style.width = `${pageW}px`
      bookData.pageWrap[p].style.height = `${height}px`
    }
    if (bookData.pages[p]) {
      bookData.pages[p].style.width = `${pageW}px`
      bookData.pages[p].style.height = `${height}px`
      const fd = flipDataMap.get(p)
      if (fd) resizeFlip(bookData.pages[p], fd, true)
    }
  }
  pw.value = pageW
  ph.value = height
  bookWidth.value = width
  bookHeight.value = height
}

function updateDisplay() {
  const data = bookData
  if (data.pageMv.length && data.pageMv[0] !== 0) {
    const pos = calculateZ(data.pageMv)
    let apage: number | undefined
    const view = viewFn(data.tpage || data.page)
    if (data.pagePlace[view[0]] === view[0]) apage = view[0]
    else if (data.pagePlace[view[1]] === view[1]) apage = view[1]
    for (const pg in data.pageWrap) {
      if (!has(pg, data.pageWrap)) continue
      const p = parseInt(pg)
      const disp = pos.pageV[p] ? '' : 'none'
      const zi = pos.pageZ[p] || 0
      if (data.pageWrap[p]) {
        Object.assign(data.pageWrap[p].style, { display: disp, zIndex: String(zi) })
      }
      if (data.pages[p]) {
        const fd = flipDataMap.get(p)
        if (fd) {
          fd.disabled = data.disabled || data.tpage ? true : disp === 'none'
          setFlipZ(fd, pos.partZ[p] || null)
        }
      }
    }
  } else {
    for (const pg in data.pageWrap) {
      if (!has(pg, data.pageWrap)) continue
      const p = parseInt(pg)
      const loc = setPageLoc(p)
      if (data.pages[p]) {
        const fd = flipDataMap.get(p)
        if (fd) {
          fd.disabled = data.disabled || loc !== 1
          setFlipZ(fd, loc === 1 ? null : 0)
        }
      } else if (loc === 1) {
        makeFlip(p)
      }
    }
  }
  _updateShadow()
}

function _updateShadow() {
  const data = bookData
  const book = bookRef.value
  if (!book) return
  const w = pw.value * 2
  const h = ph.value

  if (!data.shadow) {
    data.shadow = document.createElement('div')
    data.shadow.className = 'turn-shadow'
    Object.assign(data.shadow.style, divAtt(0, 0, 0))
    book.appendChild(data.shadow)
  }

  let view = viewFn()
  for (let i = 0; i < data.pageMv.length && view[0] && view[1]; i++) {
    const mvPg = data.pageMv[i]
    const mvFd = flipDataMap.get(mvPg)
    if (mvFd) {
      const nextView = viewFn(mvFd.opts.next)
      const mvView = viewFn(mvPg)
      view[0] = view[0] && nextView[0] && mvView[0] ? view[0] : 0
      view[1] = view[1] && nextView[1] && mvView[1] ? view[1] : 0
    }
  }

  if (view[0] || view[1]) {
    Object.assign(data.shadow.style, { width: `${w}px`, height: `${h}px`, top: '0', left: '0', zIndex: String(data.totalPages + 2), display: '' })
  } else {
    data.shadow.style.display = 'none'
  }
}

function setFlipZ(fd: FlipData, z: number | null) {
  fd.opts['z-index'] = z
  if (fd.fwrapper) {
    const parentZ = fd.parent ? parseInt(fd.parent.style.zIndex || '0', 10) : 0
    fd.fwrapper.style.zIndex = String(z ?? parentZ)
  }
}

function _pressed(flipEl: HTMLElement, fd: FlipData): number {
  for (const pg in bookData.pages) {
    if (pg === String(fd.opts.page)) continue
    const otherFd = flipDataMap.get(parseInt(pg))
    if (otherFd) otherFd.disabled = true
  }
  return Date.now()
}

function _released(flipEl: HTMLElement, fd: FlipData, point: Pt): boolean {
  const now = Date.now()
  const elapsed = now - (fd.time || 0)
  if ((elapsed < 200 || point.x < 0 || point.x > flipEl.offsetWidth)) {
    bookData.tpage = fd.opts.next
    updateDisplay()
    turnPageAnim(flipEl, fd)
    return true
  }
  return false
}

function _start(flipEl: HTMLElement, fd: FlipData, corner: string) {
  if (bookData.display === 'single') {
    const left = corner.charAt(1) === 'l'
    if ((fd.opts.page === 1 && left) || (fd.opts.page === bookData.totalPages && !left)) {
      return
    } else {
      if (left) {
        fd.opts.next = (fd.opts.next < fd.opts.page) ? fd.opts.next : fd.opts.page - 1
        fd.opts.force = true
      } else {
        fd.opts.next = (fd.opts.next > fd.opts.page) ? fd.opts.next : fd.opts.page + 1
      }
    }
  }
  addMotionPage(flipEl, fd)
}

function addMotionPage(flipEl: HTMLElement, fd: FlipData) {
  fd.opts.pageMv = fd.opts.page
  addMv(fd.opts.pageMv)
  bookData.pagePlace[fd.opts.next] = fd.opts.page
  updateDisplay()
}

function _end(flipEl: HTMLElement, fd: FlipData, turned: boolean) {
  if (turned || bookData.tpage) {
    if (bookData.tpage === fd.opts.next || bookData.tpage === fd.opts.page) {
      // turn.js 原始逻辑：先 delete tpage，再调用 _fitPage
      const targetPage = bookData.tpage || fd.opts.next
      bookData.tpage = null
      fitPage(targetPage, true)
    }
  } else {
    removeMv(fd.opts.pageMv)
    updateDisplay()
  }
}

function calculateZ(mv: number[]): { pageZ: Record<number, number>; partZ: Record<number, number>; pageV: Record<number, boolean> } {
  const view = viewFn(bookData.tpage || bookData.page)
  const currentPageVal = view[0] || view[1]
  const r: { pageZ: Record<number, number>; partZ: Record<number, number>; pageV: Record<number, boolean> } = { pageZ: {}, partZ: {}, pageV: {} }

  function addView(pg: number) {
    const v = viewFn(pg)
    if (v[0]) r.pageV[v[0]] = true
    if (v[1]) r.pageV[v[1]] = true
  }

  for (let i = 0; i < mv.length; i++) {
    const page = mv[i]
    const fd = flipDataMap.get(page)
    if (!fd) continue
    const nextPage = fd.opts.next
    const placePage = bookData.pagePlace[page]
    addView(page)
    addView(nextPage)
    const dpage = (bookData.pagePlace[nextPage] === nextPage) ? nextPage : page
    r.pageZ[dpage] = bookData.totalPages - Math.abs(currentPageVal - dpage)
    r.partZ[placePage] = bookData.totalPages * 2 + Math.abs(currentPageVal - dpage)
  }
  return r
}

function handleEventStart(e: Event) {
  const mouseE = e as MouseEvent
  for (const pg in bookData.pages) {
    if (!has(pg, bookData.pages)) continue
    const pageEl = bookData.pages[parseInt(pg)]
    const fd = flipDataMap.get(parseInt(pg))
    if (!fd || fd.disabled) continue
    const result = eventStart(pageEl, fd, e)
    if (result === false) return
  }
}

function eventStart(flipEl: HTMLElement, fd: FlipData, e: Event): boolean | void {
  if (fd.disabled) return
  if (fd.turning) return
  const activated = _cornerActivated(flipEl, e as MouseEvent)
  if (activated && _foldingPage(fd)) {
    if (animHandle !== null) {
      cancelAnimationFrame(animHandle)
      animHandle = null
    }
    fd.corner = activated
    if (fd.fparent) {
      ;(fd.fparent as any).flips = ((fd.fparent as any).flips || 0) + 1
      fd.fparent.style.display = 'block'
      fd.opts.turn.appendChild(fd.fparent)
    }
    _moveFoldingPage(flipEl, fd, true)
    _pressed(flipEl, fd)
    return false
  } else {
    fd.corner = null
  }
}

function handleEventMove(e: Event) {
  const mouseE = e as MouseEvent
  for (const pg in bookData.pages) {
    if (!has(pg, bookData.pages)) continue
    const pageEl = bookData.pages[parseInt(pg)]
    const fd = flipDataMap.get(parseInt(pg))
    if (!fd || fd.disabled) continue
    eventMove(pageEl, fd, e)
  }
}

function eventMove(flipEl: HTMLElement, fd: FlipData, e: Event) {
  if (fd.disabled) return
  const touches = isTouchDevice ? (e as TouchEvent).touches : [e as MouseEvent] as MouseEvent[]

  if (fd.corner) {
    const pos = fd.parent.getBoundingClientRect()
    fd.corner.x = touches[0].clientX - pos.left
    fd.corner.y = touches[0].clientY - pos.top
    _showFoldedPage(flipEl, fd, fd.corner)
  } else if (flipEl.offsetWidth > 0 && !fd.turning) {
    const activated = _cornerActivated(flipEl, touches[0])
    if (activated && _foldingPage(fd)) {
    } else {
      hideFoldedPage(flipEl, fd, true)
    }
  }
}

function handleEventEnd(e: Event) {
  for (const pg in bookData.pages) {
    if (!has(pg, bookData.pages)) continue
    const pageEl = bookData.pages[parseInt(pg)]
    const fd = flipDataMap.get(parseInt(pg))
    if (!fd || fd.disabled) continue
    eventEnd(pageEl, fd)
  }
}

function eventEnd(flipEl: HTMLElement, fd: FlipData) {
  if (!fd.disabled && fd.point && fd.corner) {
    const consumed = _released(flipEl, fd, fd.point)
    if (!consumed) {
      hideFoldedPage(flipEl, fd, true)
    }
  }
  fd.corner = null
}

function checkMobile() {
  isMobile.value = false
}

function initLayout() {
  const book = bookRef.value
  if (!book) return
  const rect = book.getBoundingClientRect()
  const w = rect.width
  const h = rect.height
  bookWidth.value = w
  bookHeight.value = h
  if (isSinglePage.value) {
    pw.value = w
  } else {
    pw.value = Math.floor(w / 2)
  }
  ph.value = h
  setSize(w, h)
}

function rebuildAll() {
  const book = bookRef.value
  if (!book) return
  book.innerHTML = ''
  bookData.pageObjs = {}
  bookData.pages = {}
  bookData.pageWrap = {}
  bookData.pagePlace = {}
  bookData.pageMv = []
  bookData.fparent = null
  bookData.page = 1
  bookData.tpage = null
  flipDataMap.clear()

  bookData.totalPages = props.pages.length
  setDisplay(isSinglePage.value ? 'single' : 'double')
  
  addToDom()
  bookData.done = true
  
  const targetPage = 1
  if (targetPage > 0 && targetPage <= bookData.totalPages) {
    fitPage(targetPage)
  }
}

watch(() => props.pages, () => {
  rebuildAll()
}, { deep: true })

watch(() => props.currentPage, (val) => {
  if (val !== currentPage.value) {
    currentPage.value = val
    const target = val + 1
    if (target > 0 && target <= bookData.totalPages) {
      goToPage(target)
    }
  }
})

watch(isMobile, () => {
  rebuildAll()
})

onMounted(() => {
  checkMobile()
  initLayout()
  rebuildAll()

  document.addEventListener(events.start, handleEventStart as EventListener, true)
  document.addEventListener(events.move, handleEventMove as EventListener)
  document.addEventListener(events.end, handleEventEnd as EventListener)

  window.addEventListener('resize', () => {
    checkMobile()
    initLayout()
  })
})

onUnmounted(() => {
  document.removeEventListener(events.start, handleEventStart as EventListener, true)
  document.removeEventListener(events.move, handleEventMove as EventListener)
  document.removeEventListener(events.end, handleEventEnd as EventListener)
  if (animHandle !== null) cancelAnimationFrame(animHandle)
})
</script>

<style scoped>
.turn-book-wrap {
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  padding: 1rem;
  user-select: none;
  position: relative;
}
.turn-book {
  position: relative;
  width: 100%;
  height: 42rem;
  background: #c0b9a5;
  border-radius: 4px 12px 12px 4px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25), inset 0 0 40px rgba(0,0,0,0.08);
  cursor: grab;
}
.turn-book:active { cursor: grabbing; }
.turn-page-wrapper {
  position: absolute;
  overflow: hidden;
  border-radius: 1px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.turn-page {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}
:deep(.turn-page.odd) {
  background-image: url(/img/pages_02.png);
  background-position: left center;
  background-size: auto 100%;
  background-repeat: no-repeat;
}
:deep(.turn-page.even) {
  background-image: url(/img/pages_01.png);
  background-position: right center;
  background-size: auto 100%;
  background-repeat: no-repeat;
}
:deep(.turn-shadow) {
  position: absolute;
  pointer-events: none;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding: 0 1rem;
}

.nav-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 1rem;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pg-indicator {
  font-size: 0.875rem;
  color: #666;
}
</style>