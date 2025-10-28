import axios from "axios";

export const createProduct = async (token, form) => {
    return axios.post('http://localhost:5002/api/product', form, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}

export const listProduct = async (count = 1) => {
    return axios.get('http://localhost:5002/api/products/' + count,)
}

export const readProduct = async (token, id) => {
    return axios.get('http://localhost:5002/api/product/' + id, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}


export const deleteProduct = async (token, id) => {
    return axios.delete('http://localhost:5002/api/product/' + id, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}

export const updateProduct = async (token, id, form) => {
    return axios.put('http://localhost:5002/api/product/' + id, form, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}

export const uploadFile = async (token, form) => {
    return axios.post('http://localhost:5002/api/images', {
        image: form
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}

export const removeFile = async (token, public_id) => {
    return axios.post('http://localhost:5002/api/removeimages', {
        public_id
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}


export const searchFilters = async (arg) => {
    return axios.post('http://localhost:5002/api/search/filters',arg)
}

