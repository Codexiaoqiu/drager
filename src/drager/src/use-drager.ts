import { Ref, onMounted, ref, ExtractPropTypes, watch, onBeforeUnmount } from 'vue'
import { DragerProps, DragData } from './drager'
let zIndex = 1000

export function useDrager(
  targetRef: Ref<HTMLElement | null>,
  props: ExtractPropTypes<typeof DragerProps>, 
  emit: Function
) {
  
  const dragRef = ref()
  const isMousedown = ref(false)
  const selected = ref(false)
  const dragData = ref<DragData>({
    width: props.width,
    height: props.height,
    left: props.left,
    top: props.top,
    angle: props.angle
  })
  function onMousedown(e: MouseEvent) {
    if (props.disabled) return
    isMousedown.value = true
    selected.value = true
    const el = targetRef.value!
    let { clientX: downX, clientY: downY } = e
    
    const { left, top } = dragData.value
    el.style.zIndex = useZIndex()
    let maxX = 0, maxY = 0
    if (props.boundary) {
      [maxX, maxY] = getBoundary()
    }
    
    emit && emit('drag-start', dragData.value)
    const onMousemove = (e: MouseEvent) => {
      let moveX = (e.clientX - downX) / props.scaleRatio + left
      let moveY = (e.clientY - downY) / props.scaleRatio + top

      // 是否开启网格对齐
      if (props.snapToGrid) {
        // 当前位置
        let { left: curX, top: curY } = dragData.value
        // 移动距离
        const diffX = moveX - curX
        const diffY = moveY - curY

        // 计算网格移动距离
        moveX = calcGridMove(diffX, props.gridX, curX)
        moveY = calcGridMove(diffY, props.gridY, curY)
      }
      
      if (props.boundary) {
        [moveX, moveY] = fixBoundary(moveX, moveY, maxX, maxY)
      }

      dragData.value.left = moveX
      dragData.value.top = moveY
      
      emit && emit('drag', dragData.value)
    }

    setupMove(onMousemove, (e: MouseEvent) => {
      isMousedown.value = false
      document.addEventListener('click', clickOutsize, { once: true })
      emit && emit('drag-end', dragData.value)
    })
  }
  const getBoundary = () => {
    const { width, height } = dragData.value
    const parentEl = targetRef.value!.parentElement || document.body
    const parentElRect = parentEl!.getBoundingClientRect()
    // 最大x
    const maxX = parentElRect.width / props.scaleRatio - width
    // 最大y
    const maxY = parentElRect.height / props.scaleRatio - height
    return [maxX, maxY]
  }
  const fixBoundary = (moveX: number, moveY: number, maxX: number, maxY: number) => {
    // 判断x最小最大边界
    moveX = moveX < 0 ? 0 : moveX
    moveX = moveX > maxX ? maxX : moveX

    // 判断y最小最大边界
    moveY = moveY < 0 ? 0 : moveY
    moveY = moveY > maxY ? maxY : moveY
    return [moveX, moveY]
  }
  const clickOutsize = () => {
    selected.value = false
  }
  // 键盘事件
  const onKeydown = (e: KeyboardEvent) => {
    if (isMousedown.value) return
    let { left: moveX, top: moveY } = dragData.value
    if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
      const isRight = e.key === 'ArrowRight'
      let diff = isRight ? 1 : -1
      if (props.snapToGrid) {
        diff = isRight ? props.gridX : -props.gridX
      }
      moveX = moveX + diff
      
    } else if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
      const isDown = e.key === 'ArrowDown'
      let diff = isDown ? 1 : -1
      if (props.snapToGrid) {
        diff = isDown ? props.gridY : -props.gridY
      }

      moveY = moveY + diff
    }

    if (props.boundary) {
      const [maxX, maxY] = getBoundary()
      ;[moveX, moveY] = fixBoundary(moveX, moveY, maxX, maxY)
    }
    dragData.value.left = moveX
    dragData.value.top = moveY
  }
  onMounted(() => {
    if (!targetRef.value) return
    targetRef.value.addEventListener('mousedown', onMousedown)
  })

  watch(selected, (val) => {
    if (props.disabledKeyEvent) return
    // 每次选中注册键盘事件
    if (val) {
      document.addEventListener('keydown', onKeydown)
    } else { // 不是选中移除
      document.removeEventListener('keydown', onKeydown)
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
  return {
    isMousedown,
    selected,
    dragRef,
    dragData
  }
}

export function useZIndex() {
  return ++zIndex + ''
}

/**
 * 统一处理拖拽事件
 * @param onMousemove 鼠标移动处理函数
 */
export function setupMove(onMousemove: (e: MouseEvent) => void, onMouseupCb?: (e: MouseEvent) => void) {
  const onMouseup = (_e: MouseEvent) => {
    onMouseupCb && onMouseupCb(_e)
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
  }
  document.addEventListener('mousemove', onMousemove)
  document.addEventListener('mouseup', onMouseup)
}

/**
 * @param diff 移动的距离
 * @param grid 网格大小
 * @param cur 盒子当前的位置left or top
 */
function calcGridMove(diff: number, grid: number, cur: number) {
  let result = cur
  // 移动距离超过grid的1/2，累加grid，移动距离位负数减掉相应的grid
  if (Math.abs(diff) > grid / 2) {
    result = cur + (diff > 0 ? grid : -grid)
  }

  return result
}
