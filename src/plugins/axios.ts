import axios from 'axios'

const instance = axios.create({
    baseURL: '',
    timeout: 3000,
    headers: {
        'Content-Type': 'application/json',
    },
})

instance.interceptors.request.use(
    (config) => config,
    (error) => Promise.reject(error)
)

instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
)

export default instance
