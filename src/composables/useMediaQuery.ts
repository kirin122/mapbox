import { ref, onMounted, onUnmounted } from 'vue'

export function useMediaQuery(query: string) {
    const matches = ref(false)

    let mediaQuery: MediaQueryList

    const updateMatch = () => {
        matches.value = mediaQuery.matches
    }

    onMounted(() => {
        mediaQuery = window.matchMedia(query)
        mediaQuery.addEventListener('change', updateMatch)
        updateMatch()
    })

    onUnmounted(() => {
        mediaQuery?.removeEventListener('change', updateMatch)
    })

    return matches
}
