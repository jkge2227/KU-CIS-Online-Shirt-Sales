import React, { useState, useEffect } from 'react'
import useEcomStore from '../store/ecom-store'
import { currentUser } from '../api/auth'
import LoadingToRedirect from '../routes/LoadingToRedirect'

const ProtectRoutUser = ({ element }) => {
    const [ok, setOk] = useState(false)
    const user = useEcomStore((state) => state.users)
    const token = useEcomStore((state) => state.token)

    useEffect(() => {
        if (user && token) {
            // send to back
            currentUser(token)
                .then((res) => setOk(true))
                .catch((err) => setOk(false))
        }
    }, [])

    return ok ? element : <LoadingToRedirect />
}

export default ProtectRoutUser