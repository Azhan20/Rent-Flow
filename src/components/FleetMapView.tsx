import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Navigation, 
  Truck, 
  Fuel, 
  Clock, 
  Layers, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext.tsx';

interface EquipmentGpsUnit {
  id: string;
  name: string;
  sku: string;
  category: string;
  status: 'ON_RENT' | 'IN_DEPOT' | 'IN_TRANSIT' | 'MAINTENANCE';
  lat: number;
  lng: number;
  customerName?: string;
  siteAddress: string;
  hourMeter: number;
  fuelLevel: number;
  speedKmh: number;
  lastPing: string;
}

export const FleetMapView: React.FC = () => {
  const { currentOrg, equipmentList, bookings } = useRentFlow();
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<EquipmentGpsUnit | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [activeDepot, setActiveDepot] = useState<{ name: string; lat: number; lng: number }>({
    name: 'Apex Industrial Depot North',
    lat: 37.7749,
    lng: -122.4194,
  });

  // Fetch Maps API key from backend config
  useEffect(() => {
    fetch('/api/config/maps')
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch((err) => console.warn('Could not load Maps key:', err));

    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Live fleet coordinates centered around the depot
  const fleetUnits: EquipmentGpsUnit[] = [
    {
      id: 'eq-cat320-1',
      name: 'CAT 320 GC Hydraulic Excavator #1',
      sku: 'EXC-320-001',
      category: 'Earthmoving',
      status: 'ON_RENT',
      lat: 37.7885,
      lng: -122.4072,
      customerName: 'Metro High-Rise Builders',
      siteAddress: '350 Mission St, San Francisco, CA',
      hourMeter: 418.5,
      fuelLevel: 78,
      speedKmh: 0,
      lastPing: '2 mins ago',
    },
    {
      id: 'eq-cat320-2',
      name: 'CAT 320 GC Hydraulic Excavator #2',
      sku: 'EXC-320-002',
      category: 'Earthmoving',
      status: 'IN_DEPOT',
      lat: 37.7749,
      lng: -122.4194,
      siteAddress: 'Apex Depot North Yard - Ready Bay B3',
      hourMeter: 312.0,
      fuelLevel: 100,
      speedKmh: 0,
      lastPing: 'Just now',
    },
    {
      id: 'eq-genie-1',
      name: 'Genie S-65 Telescopic Boom Lift',
      sku: 'LIFT-S65-001',
      category: 'Aerial & Access',
      status: 'ON_RENT',
      lat: 37.7652,
      lng: -122.4285,
      customerName: 'Pacific Infrastructure Corp',
      siteAddress: 'Central Viaduct Repair Site, Sector 4',
      hourMeter: 685.2,
      fuelLevel: 64,
      speedKmh: 0,
      lastPing: '5 mins ago',
    },
    {
      id: 'eq-cummins-1',
      name: 'Cummins QAS 150 Mobile Generator',
      sku: 'GEN-150-001',
      category: 'Power Generation',
      status: 'IN_TRANSIT',
      lat: 37.7812,
      lng: -122.4140,
      customerName: 'Bay Area Festival Grounds',
      siteAddress: 'Transport Vehicle #4 (En route to Golden Gate Pier)',
      hourMeter: 1240.4,
      fuelLevel: 92,
      speedKmh: 42,
      lastPing: '1 min ago',
    },
    {
      id: 'eq-tele-1',
      name: 'JCB 540-140 Telehandler 14m',
      sku: 'TH-540-001',
      category: 'Material Handling',
      status: 'MAINTENANCE',
      lat: 37.7735,
      lng: -122.4220,
      siteAddress: 'Apex Maintenance Workshop Bay #2',
      hourMeter: 940.8,
      fuelLevel: 45,
      speedKmh: 0,
      lastPing: '12 mins ago',
    },
  ];

  const filteredUnits = fleetUnits.filter((unit) => {
    if (statusFilter === 'ALL') return true;
    return unit.status === statusFilter;
  });

  const getStatusColor = (status: EquipmentGpsUnit['status']) => {
    switch (status) {
      case 'ON_RENT':
        return { bg: '#10b981', border: '#065f46', text: 'On Rent', pinGlyph: '🏗️' };
      case 'IN_DEPOT':
        return { bg: '#3b82f6', border: '#1e40af', text: 'In Depot', pinGlyph: '🏢' };
      case 'IN_TRANSIT':
        return { bg: '#f59e0b', border: '#92400e', text: 'In Transit', pinGlyph: '🚚' };
      case 'MAINTENANCE':
        return { bg: '#8b5cf6', border: '#5b21b6', text: 'Maintenance', pinGlyph: '🔧' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Maps Quota Warning Banner per Guidelines */}
      {quotaExceeded && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm rounded-xl flex items-center justify-between shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
          <button onClick={() => setQuotaExceeded(false)} className="text-amber-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-amber-500" />
              Live Fleet GPS & Telematics Dispatch
            </h2>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <Radio className="w-3 h-3 animate-pulse" />
              Real-Time Tracking
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centrally monitor machinery positions, job site deployments, depot inventory, and telemetry across {currentOrg.name}.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'ON_RENT', 'IN_DEPOT', 'IN_TRANSIT', 'MAINTENANCE'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === status
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Map Layout & Telematics Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Google Map Container */}
        <div className="lg:col-span-3 h-[580px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md relative bg-slate-900">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <Map
                mapId="DEMO_MAP_ID"
                defaultCenter={{ lat: activeDepot.lat, lng: activeDepot.lng }}
                defaultZoom={13}
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              >
                {/* Central Depot Marker */}
                <AdvancedMarker
                  position={{ lat: activeDepot.lat, lng: activeDepot.lng }}
                  title={activeDepot.name}
                >
                  <Pin background="#1e293b" borderColor="#0f172a" glyphColor="#f59e0b" scale={1.2}>
                    <Building2 className="w-4 h-4 text-amber-400" />
                  </Pin>
                </AdvancedMarker>

                {/* Fleet Machinery Markers */}
                {filteredUnits.map((unit) => {
                  const color = getStatusColor(unit.status);
                  return (
                    <AdvancedMarker
                      key={unit.id}
                      position={{ lat: unit.lat, lng: unit.lng }}
                      onClick={() => setSelectedUnit(unit)}
                      title={unit.name}
                    >
                      <Pin 
                        background={color.bg} 
                        borderColor={color.border} 
                        glyphColor="#ffffff"
                        scale={1.1}
                      >
                        <span className="text-xs">{color.pinGlyph}</span>
                      </Pin>
                    </AdvancedMarker>
                  );
                })}

                {/* Interactive InfoWindow on Marker Click */}
                {selectedUnit && (
                  <InfoWindow
                    position={{ lat: selectedUnit.lat, lng: selectedUnit.lng }}
                    onCloseClick={() => setSelectedUnit(null)}
                  >
                    <div className="p-1 max-w-xs text-slate-900">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {selectedUnit.sku}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600">
                          {selectedUnit.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{selectedUnit.name}</h4>
                      <p className="text-xs text-slate-500 mb-2">{selectedUnit.siteAddress}</p>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Operating Hours</span>
                          <span className="font-mono font-bold text-slate-800">{selectedUnit.hourMeter} hrs</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Fuel Tank</span>
                          <span className="font-mono font-bold text-slate-800">{selectedUnit.fuelLevel}%</span>
                        </div>
                      </div>

                      {selectedUnit.customerName && (
                        <div className="mt-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-400">Assigned Customer: </span>
                          <span className="font-semibold text-slate-800">{selectedUnit.customerName}</span>
                        </div>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          ) : (
            /* Fallback interactive canvas with coordinate radar while API key loads */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-950">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                <Navigation className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Connecting to Google Maps Platform</h3>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                Initializing `@vis.gl/react-google-maps` and dispatching live GPS telematics for {filteredUnits.length} active units...
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-sm w-full text-left bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Active GPS Beacons</span>
                  <span className="text-white font-mono font-bold">5 Machines Online</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Depot Base</span>
                  <span className="text-amber-400 font-mono font-bold">Apex North Yard</span>
                </div>
              </div>
            </div>
          )}

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-3 rounded-xl shadow-lg z-10 text-xs text-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">Fleet Status Legend</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>On Rent (Customer Site)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>In Depot (Ready Bay)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>In Transit (En Route)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Maintenance / Service</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Dispatch List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col h-[580px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 mb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" />
              Tracked Fleet ({filteredUnits.length})
            </h3>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
              Live
            </span>
          </div>

          <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
            {filteredUnits.map((unit) => {
              const color = getStatusColor(unit.status);
              const isSelected = selectedUnit?.id === unit.id;
              return (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {unit.sku}
                    </span>
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: color.bg }}
                    >
                      {color.text}
                    </span>
                  </div>

                  <h4 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                    {unit.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {unit.siteAddress}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {unit.hourMeter} hrs
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Fuel className="w-3 h-3 text-amber-500" />
                      {unit.fuelLevel}%
                    </span>
                    <span className="text-slate-400 font-mono">
                      {unit.lastPing}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Depot Info Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-2 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="font-medium text-[11px]">Primary Depot:</span>
              <span className="font-semibold text-slate-900 dark:text-white text-[11px]">{activeDepot.name}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">GPS Geofencing Active • 50m Return Buffer</p>
          </div>
        </div>
      </div>
    </div>
  );
};
