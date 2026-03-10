import DroneUploader from "@/components/DroneUploader"

export default function Home() {

return (

<main className="p-10">

<h1 className="text-3xl font-bold">
Autonomous Coconut Harvesting System
</h1>

<p className="mt-4 text-gray-600">
Drone Tree Detection and Coconut Ripeness Analysis
</p>

<DroneUploader/>

</main>

)

}