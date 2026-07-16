import Link from "next/link"

const PIPELINE = [
  "Survey",
  "Digital Twin",
  "Inspection",
  "Inventory",
  "Harvest Mission",
  "Robot Simulation",
  "Mission History & Analytics",
]

export default function Home() {
  return (
    <main className="p-10 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold">
        Autonomous Coconut Harvesting System
      </h1>
      <p className="mt-3 text-lg text-gray-600">
        A digital-twin platform that turns drone surveys into a live plantation
        model and drives a robot to harvest it.
      </p>
      <p className="mt-1 text-sm font-medium text-emerald-700">
        Version 3
      </p>

      <div className="mt-8">
        <Link
          href="/dashboard"
          className="inline-block bg-emerald-700 text-white px-5 py-2.5 rounded font-semibold hover:bg-emerald-800"
        >
          Open Dashboard
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">Pipeline</h2>
        <ol className="space-y-2">
          {PIPELINE.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-gray-800">{step}</span>
              {i < PIPELINE.length - 1 && (
                <span className="text-emerald-400 ml-1">→</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
