import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import Resizer from 'react-image-file-resizer'
import { removeFile, uploadFile } from '../../api/product'
import useEcomStore from '../../store/ecom-store'
import { Loader } from 'lucide-react'

const Uploadfile = ({ form, setForm }) => {
  const token = useEcomStore((state) => state.token)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  const resizeToBase64 = (file) =>
    new Promise((resolve, reject) => {
      Resizer.imageFileResizer(
        file,
        720,
        720,
        'JPEG',
        90,   // คุณภาพ 90 พอคมและเบา
        0,
        (uri) => resolve(uri),
        'base64'
      )
    })

  const handleOnChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setIsLoading(true)
    try {
      // คัดเฉพาะรูป
      const imageFiles = files.filter((f) => {
        const ok = f.type.startsWith('image/')
        if (!ok) toast.error(`ไฟล์ ${f.name} ไม่ใช่รูปภาพ`)
        return ok
      })

      // resize -> upload (parallel)
      const uploaded = await Promise.all(
        imageFiles.map(async (file) => {
          const base64 = await resizeToBase64(file)
          const res = await uploadFile(token, base64) // server คืน {asset_id, public_id, url, secure_url, ...}
          return res.data
        })
      )

      // กันซ้ำด้วย public_id + ต่อท้ายของเดิมแบบไม่ mutate
      setForm((prev) => {
        const merged = [...(prev.images || []), ...uploaded]
        const uniq = Array.from(
          new Map(merged.map((img) => [img.public_id, img])).values()
        )
        return { ...prev, images: uniq }
      })

      toast.success('อัปโหลดรูปสำเร็จ')
    } catch (err) {
      console.log(err)
      toast.error('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setIsLoading(false)
      // เคลียร์ค่า input เพื่อให้อัปโหลดไฟล์เดิมซ้ำได้
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (public_id) => {
    try {
      await removeFile(token, public_id)
      setForm((prev) => ({
        ...prev,
        images: (prev.images || []).filter((img) => img.public_id !== public_id),
      }))
      toast.success('ลบรูปภาพสำเร็จ')
    } catch (err) {
      console.log(err)
      toast.error('ลบรูปภาพไม่สำเร็จ')
    }
  }

  return (
    <div>
      <div className="flex mx-4 gap-4 my-4 items-center flex-wrap">
        {isLoading && <Loader className="w-6 h-6 animate-spin text-gray-500" />}

        {(form.images || []).map((item) => (
          <div className="relative group" key={item.public_id}>
            <img
              className="w-24 h-24 rounded-lg object-cover border hover:scale-105 transition"
              src={item.url}
              alt=""
            />
            <button
              type="button"
              onClick={() => handleDelete(item.public_id)}
              className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-90 hover:opacity-100"
              title="ลบรูปนี้"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div>
        <input
          ref={inputRef}
          onChange={handleOnChange}
          type="file"
          name="images"
          multiple
          accept="image/*"       // ✅ รับเฉพาะรูป
          className="block w-full text-sm text-gray-700
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-md file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100"
        />
      </div>
    </div>
  )
}

export default Uploadfile
