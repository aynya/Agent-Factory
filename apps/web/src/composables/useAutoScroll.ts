import { ref, nextTick, watch, onMounted, type Ref, type MaybeRefOrGetter } from 'vue'

export interface UseAutoScrollOptions {
  /**
   * 是否启用滚动按钮
   * @default true
   */
  enableScrollButton?: boolean
  /**
   * 是否在挂载时自动滚动到底部
   * @default true
   */
  scrollOnMount?: boolean
  /**
   * 接近底部的阈值（像素）
   * @default 50
   */
  nearBottomThreshold?: number
  /**
   * 监听的数据源，当数据变化时自动滚动（仅在接近底部时）
   */
  watchSource?: MaybeRefOrGetter<unknown>
  /**
   * 是否深度监听 watchSource
   * @default true
   */
  deep?: boolean
  /**
   * 自定义按钮可见性检查函数，返回 true 表示应该显示按钮
   * 如果提供此函数，将覆盖默认的可见性检查逻辑
   */
  customVisibilityCheck?: () => boolean
}

/**
 * 自动滚动到底部的 composable
 * @param containerRef 滚动容器的 ref
 * @param options 配置选项
 */
export function useAutoScroll(
  containerRef: Ref<HTMLElement | null>,
  options: UseAutoScrollOptions = {}
) {
  const {
    enableScrollButton = true,
    scrollOnMount = true,
    nearBottomThreshold = 50,
    watchSource,
    deep = true,
    customVisibilityCheck,
  } = options

  const showScrollButton = ref(false)

  /**
   * 检查是否接近底部
   */
  function checkIsNearBottom(): boolean {
    if (!containerRef.value) return false
    return (
      containerRef.value.scrollHeight -
        containerRef.value.scrollTop -
        containerRef.value.clientHeight <
      nearBottomThreshold
    )
  }

  /**
   * 更新滚动按钮显示状态
   */
  function updateScrollButtonVisibility() {
    if (!enableScrollButton) {
      showScrollButton.value = false
      return
    }

    // 如果提供了自定义可见性检查函数，使用它
    if (customVisibilityCheck) {
      showScrollButton.value = customVisibilityCheck()
      return
    }

    // 默认逻辑：如果接近底部，隐藏按钮；否则显示按钮
    showScrollButton.value = !checkIsNearBottom()
  }

  /**
   * 滚动到底部
   * @param isCheck 是否检查接近底部（true: 只有接近底部时才滚动, false: 强制滚动）
   */
  function scrollToBottom(isCheck = true) {
    nextTick(() => {
      if (!containerRef.value) return

      // 如果需要检查且不接近底部，则不滚动
      if (isCheck && !checkIsNearBottom()) {
        return
      }

      const scrollToValue = containerRef.value.scrollHeight

      // 执行滚动
      containerRef.value.scrollTop = scrollToValue
    })
  }

  /**
   * 滚动事件处理函数
   */
  function handleScroll() {
    updateScrollButtonVisibility()
  }

  // 监听数据源变化，自动滚动到底部
  if (watchSource) {
    watch(
      watchSource,
      () => {
        // 消息更新时自动滚动到底部（仅在接近底部时）
        scrollToBottom(true)
      },
      { deep }
    )
  }

  // 挂载时滚动到底部
  if (scrollOnMount) {
    onMounted(() => {
      scrollToBottom(false)
    })
  }

  return {
    showScrollButton,
    checkIsNearBottom,
    updateScrollButtonVisibility,
    scrollToBottom,
    handleScroll,
  }
}
