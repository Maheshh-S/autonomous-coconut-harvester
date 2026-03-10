'use client'

import { useState } from "react"

export default function DroneUploader(){

const [image,setImage]=useState<File | null>(null)
const [preview,setPreview]=useState<string | null>(null)

function handleChange(e:React.ChangeEvent<HTMLInputElement>){

const file=e.target.files?.[0]

if(!file) return

setImage(file)

const url=URL.createObjectURL(file)
setPreview(url)

}

return(

<div className="mt-8">

<h2 className="text-xl font-semibold mb-4">
Upload Drone Image
</h2>

<input
type="file"
accept="image/*"
onChange={handleChange}
/>

{preview && (

<div className="mt-6">

<p className="mb-2 text-gray-600">
Preview
</p>

<img
src={preview}
alt="preview"
className="w-[600px] rounded shadow"
/>

</div>

)}

</div>

)

}