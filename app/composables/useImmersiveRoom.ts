export const useImmersiveRoom = () => {
  const isImmersiveOpen = useState<boolean>('immersive-study-room-open', () => false)

  const openImmersive = () => {
    isImmersiveOpen.value = true
  }

  const closeImmersive = () => {
    isImmersiveOpen.value = false
  }

  const toggleImmersive = () => {
    isImmersiveOpen.value = !isImmersiveOpen.value
  }

  return {
    isImmersiveOpen,
    openImmersive,
    closeImmersive,
    toggleImmersive,
  }
}
