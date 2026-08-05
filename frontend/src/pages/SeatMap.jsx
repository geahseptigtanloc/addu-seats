/**
 * Seat Map page — placeholder for Phase 2 interactive SVG floor map.
 */
import Layout from '../components/Layout.jsx';

export default function SeatMap() {
  return (
    <Layout>
      <h1 className="text-xl font-semibold text-gray-800">Seat Map</h1>
      <p className="mt-2 text-gray-500">
        Real-time seat availability will appear here.
      </p>

      {/* Phase 2: interactive SVG seat map rendering goes here */}
      <div className="mt-8 flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
        <p className="text-sm text-gray-400">Seat map — coming in Phase 2</p>
      </div>
    </Layout>
  );
}
