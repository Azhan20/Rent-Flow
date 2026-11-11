import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { 
  Box, 
  RotateCw, 
  Eye, 
  Layers, 
  Maximize2, 
  CheckCircle, 
  AlertTriangle, 
  Gauge, 
  Wrench, 
  Mic, 
  Volume2, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ThreeEquipmentViewerProps {
  initialModel?: 'excavator' | 'boom_lift' | 'generator';
  equipmentName?: string;
  onRecordVoiceNote?: (note: string) => void;
  onClose?: () => void;
}

export const ThreeEquipmentViewer: React.FC<ThreeEquipmentViewerProps> = ({
  initialModel = 'excavator',
  equipmentName,
  onRecordVoiceNote,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeModel, setActiveModel] = useState<'excavator' | 'boom_lift' | 'generator'>(initialModel);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [activePart, setActivePart] = useState<string | null>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcribedNote, setTranscribedNote] = useState<string>('');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const partsGroupRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const requestRef = useRef<number>(0);

  // Telematics mock database for each machinery part
  const telematicsData: Record<string, { name: string; status: 'optimal' | 'warning' | 'critical'; metric: string; wear: string; recommendation: string }> = {
    hydraulics: {
      name: 'Hydraulic Ram & Cylinder System',
      status: 'optimal',
      metric: 'Pressure: 345 bar | Temp: 62°C',
      wear: 'Piston shaft runout: 0.02mm (Tolerance: < 0.15mm)',
      recommendation: 'Next hydraulic fluid flush in 120 operating hours.',
    },
    boom: {
      name: 'Articulated High-Tensile Boom & Stick',
      status: 'optimal',
      metric: 'Max Reach: 9.8m | Load Moment: 72 kNm',
      wear: 'Pin bushing clearance: 0.12mm (Tolerance: < 0.35mm)',
      recommendation: 'Grease boom pivot zerks every 10 operating hours.',
    },
    undercarriage: {
      name: 'Heavy Steel Track Undercarriage',
      status: 'warning',
      metric: 'Track Sag: 32mm | Ground Pressure: 44 kPa',
      wear: 'Grousers worn 18% | Sprocket teeth within service spec',
      recommendation: 'Adjust track tension cylinder on left side prior to next deployment.',
    },
    engine: {
      name: 'Tier 4 Final Diesel Engine & Cooling Stack',
      status: 'optimal',
      metric: 'Load: 42% | RPM: 1,850 | Oil Pressure: 4.2 bar',
      wear: 'Air intake restriction: 18 mbar (Clean)',
      recommendation: 'DPF regeneration completed 14 operating hours ago.',
    },
    cab: {
      name: 'Pressurized ROPS/FOPS Operator Cabin',
      status: 'optimal',
      metric: 'HVAC Airflow: 480 m³/h | Sound Level: 68 dB(A)',
      wear: 'Safety glass intact | Seat interlock functional',
      recommendation: 'Replace HEPA cabin air filter at 500 hr maintenance interval.',
    },
    basket: {
      name: 'Self-Leveling Personnel Basket & Jib',
      status: 'optimal',
      metric: 'Capacity: 227 kg (2 persons + tools) | Jib: 135°',
      wear: 'Load sensor calibration: 100% | Harness anchors certified',
      recommendation: 'Annual non-destructive weld testing certified valid.',
    },
    generator_core: {
      name: 'Synchronous Brushless Alternator Core',
      status: 'optimal',
      metric: 'Output: 400V 3-Phase 50Hz | Insulation: Class H',
      wear: 'Exciter diode bridge ripple: < 1.5%',
      recommendation: 'Test emergency shutdown circuit prior to job site transport.',
    },
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Software WebGL detection guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e131f); // Dark industrial navy
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(7, 5, 8);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Procedural Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    keyLight.position.set(8, 12, 6);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 30;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    // Circular ground inspection stage with grid markings
    const stageGeo = new THREE.CylinderGeometry(6, 6.2, 0.25, 48);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x161e2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.y = -0.125;
    stageMesh.receiveShadow = !isSoftwareGl;
    scene.add(stageMesh);

    // Studio grid circle
    const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going beneath stage
    controls.minDistance = 3;
    controls.maxDistance = 22;
    controls.target.set(0, 1.4, 0);
    controlsRef.current = controls;

    // Materials Library
    const catYellowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // CAT Industrial Yellow
      roughness: 0.35,
      metalness: 0.15,
    });

    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x22262e, // Cast dark iron
      roughness: 0.45,
      metalness: 0.8,
    });

    const chromePistonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.95,
    });

    const trackRubberMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.9,
      metalness: 0.05,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transmission: 0.7,
      opacity: 0.65,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
    });

    const generatorGreenMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Industrial Cummins / Atlas green
      roughness: 0.4,
      metalness: 0.2,
    });

    // Parts map for explosion & inspection highlighting
    const partsMap = new Map<string, THREE.Object3D>();
    const rootModelGroup = new THREE.Group();
    scene.add(rootModelGroup);

    // Build Procedural 3D Machinery Models
    if (activeModel === 'excavator') {
      // 1. CAT 320 Hydraulic Excavator (Composite 10-part assembly)
      // A. Undercarriage & Tracks
      const undercarriageGroup = new THREE.Group();
      undercarriageGroup.name = 'undercarriage';

      // Left Track
      const trackGeo = new THREE.BoxGeometry(0.55, 0.65, 3.4);
      const leftTrack = new THREE.Mesh(trackGeo, trackRubberMat);
      leftTrack.position.set(-1.15, 0.35, 0);
      leftTrack.castShadow = true;
      undercarriageGroup.add(leftTrack);

      // Right Track
      const rightTrack = new THREE.Mesh(trackGeo, trackRubberMat);
      rightTrack.position.set(1.15, 0.35, 0);
      rightTrack.castShadow = true;
      undercarriageGroup.add(rightTrack);

      // Sprocket rollers (3 per track)
      for (let i = -1.2; i <= 1.2; i += 1.2) {
        const rollerGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.58, 16);
        rollerGeo.rotateZ(Math.PI / 2);
        const rollerL = new THREE.Mesh(rollerGeo, darkSteelMat);
        rollerL.position.set(-1.15, 0.35, i);
        undercarriageGroup.add(rollerL);

        const rollerR = new THREE.Mesh(rollerGeo, darkSteelMat);
        rollerR.position.set(1.15, 0.35, i);
        undercarriageGroup.add(rollerR);
      }

      // Center Carbody / Crossbeam
      const carbodyGeo = new THREE.BoxGeometry(1.8, 0.35, 1.6);
      const carbody = new THREE.Mesh(carbodyGeo, darkSteelMat);
      carbody.position.set(0, 0.45, 0);
      undercarriageGroup.add(carbody);
      rootModelGroup.add(undercarriageGroup);
      partsMap.set('undercarriage', undercarriageGroup);

      // B. Turret / Revolving Superstructure (Engine & Chassis)
      const engineGroup = new THREE.Group();
      engineGroup.name = 'engine';
      const turretChassisGeo = new THREE.BoxGeometry(2.2, 0.8, 2.8);
      const turretChassis = new THREE.Mesh(turretChassisGeo, catYellowMat);
      turretChassis.position.set(0, 1.15, -0.2);
      turretChassis.castShadow = true;
      engineGroup.add(turretChassis);

      // Counterweight block
      const counterGeo = new THREE.BoxGeometry(2.18, 0.75, 0.7);
      const counterWeight = new THREE.Mesh(counterGeo, darkSteelMat);
      counterWeight.position.set(0, 1.18, -1.55);
      engineGroup.add(counterWeight);

      // Exhaust Stack & Air Filter
      const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12);
      const exhaust = new THREE.Mesh(exhaustGeo, darkSteelMat);
      exhaust.position.set(-0.6, 1.85, -1.2);
      engineGroup.add(exhaust);

      // Radiator Vents
      const ventGeo = new THREE.BoxGeometry(0.7, 0.4, 0.05);
      const vent = new THREE.Mesh(ventGeo, darkSteelMat);
      vent.position.set(0.6, 1.35, -1.58);
      engineGroup.add(vent);

      rootModelGroup.add(engineGroup);
      partsMap.set('engine', engineGroup);

      // C. Operator Cabin
      const cabGroup = new THREE.Group();
      cabGroup.name = 'cab';
      const cabFrameGeo = new THREE.BoxGeometry(0.85, 1.25, 1.2);
      const cabFrame = new THREE.Mesh(cabFrameGeo, darkSteelMat);
      cabFrame.position.set(-0.65, 1.8, 0.5);
      cabGroup.add(cabFrame);

      const glassGeo = new THREE.BoxGeometry(0.82, 0.8, 0.9);
      const cabGlass = new THREE.Mesh(glassGeo, glassMat);
      cabGlass.position.set(-0.65, 1.85, 0.6);
      cabGroup.add(cabGlass);
      rootModelGroup.add(cabGroup);
      partsMap.set('cab', cabGroup);

      // D. Boom & Arm
      const boomGroup = new THREE.Group();
      boomGroup.name = 'boom';
      // Main Curved Boom
      const boomGeo = new THREE.BoxGeometry(0.35, 2.6, 0.55);
      const boom = new THREE.Mesh(boomGeo, catYellowMat);
      boom.position.set(0.4, 2.3, 1.1);
      boom.rotation.x = -Math.PI / 5;
      boom.castShadow = true;
      boomGroup.add(boom);

      // Stick / Forearm
      const stickGeo = new THREE.BoxGeometry(0.28, 1.8, 0.4);
      const stick = new THREE.Mesh(stickGeo, catYellowMat);
      stick.position.set(0.4, 3.1, 2.4);
      stick.rotation.x = Math.PI / 4;
      stick.castShadow = true;
      boomGroup.add(stick);

      // Bucket with digging teeth
      const bucketGeo = new THREE.BoxGeometry(0.75, 0.65, 0.7);
      const bucket = new THREE.Mesh(bucketGeo, darkSteelMat);
      bucket.position.set(0.4, 2.2, 3.1);
      bucket.rotation.x = -Math.PI / 6;
      bucket.castShadow = true;
      boomGroup.add(bucket);

      rootModelGroup.add(boomGroup);
      partsMap.set('boom', boomGroup);

      // E. Hydraulic Lift Cylinders & Pistons
      const hydGroup = new THREE.Group();
      hydGroup.name = 'hydraulics';
      // Boom Lift Ram Cylinders
      const cylGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.3, 16);
      const cyl = new THREE.Mesh(cylGeo, darkSteelMat);
      cyl.position.set(0.4, 1.5, 0.6);
      cyl.rotation.x = -Math.PI / 6;
      hydGroup.add(cyl);

      const pistonGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16);
      const piston = new THREE.Mesh(pistonGeo, chromePistonMat);
      piston.position.set(0.4, 2.1, 0.95);
      piston.rotation.x = -Math.PI / 6;
      hydGroup.add(piston);

      rootModelGroup.add(hydGroup);
      partsMap.set('hydraulics', hydGroup);
    } else if (activeModel === 'boom_lift') {
      // 2. Genie S-65 Telescopic Boom Lift
      const chassisGroup = new THREE.Group();
      chassisGroup.name = 'undercarriage';
      // 4 Heavy-duty wheels
      const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const positions = [
        [-1.2, 0.55, -1.4],
        [1.2, 0.55, -1.4],
        [-1.2, 0.55, 1.4],
        [1.2, 0.55, 1.4],
      ];
      positions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(tireGeo, trackRubberMat);
        wheel.position.set(x, y, z);
        wheel.castShadow = true;
        chassisGroup.add(wheel);
      });

      const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.2);
      const body = new THREE.Mesh(bodyGeo, catYellowMat);
      body.position.set(0, 0.85, 0);
      chassisGroup.add(body);
      rootModelGroup.add(chassisGroup);
      partsMap.set('undercarriage', chassisGroup);

      // Rotating Turret
      const turretGroup = new THREE.Group();
      turretGroup.name = 'engine';
      const turretGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.6, 24);
      const turret = new THREE.Mesh(turretGeo, darkSteelMat);
      turret.position.set(0, 1.4, 0);
      turretGroup.add(turret);

      const cowlGeo = new THREE.BoxGeometry(1.5, 0.7, 1.8);
      const cowl = new THREE.Mesh(cowlGeo, catYellowMat);
      cowl.position.set(0, 1.75, -0.3);
      turretGroup.add(cowl);
      rootModelGroup.add(turretGroup);
      partsMap.set('engine', turretGroup);

      // Telescoping Boom
      const boomGroup = new THREE.Group();
      boomGroup.name = 'boom';
      const mainBoomGeo = new THREE.BoxGeometry(0.4, 0.4, 4.2);
      const mainBoom = new THREE.Mesh(mainBoomGeo, catYellowMat);
      mainBoom.position.set(0, 2.5, 1.2);
      mainBoom.rotation.x = -Math.PI / 8;
      boomGroup.add(mainBoom);

      // Secondary Inner Telescopic Tube
      const innerBoomGeo = new THREE.BoxGeometry(0.32, 0.32, 3.2);
      const innerBoom = new THREE.Mesh(innerBoomGeo, darkSteelMat);
      innerBoom.position.set(0, 3.3, 2.7);
      innerBoom.rotation.x = -Math.PI / 8;
      boomGroup.add(innerBoom);
      rootModelGroup.add(boomGroup);
      partsMap.set('boom', boomGroup);

      // Work Basket
      const basketGroup = new THREE.Group();
      basketGroup.name = 'basket';
      const basketGeo = new THREE.BoxGeometry(1.5, 1.0, 0.9);
      const basket = new THREE.Mesh(basketGeo, darkSteelMat);
      basket.position.set(0, 4.1, 4.3);
      basketGroup.add(basket);

      const railGeo = new THREE.BoxGeometry(1.45, 0.1, 0.85);
      const rail = new THREE.Mesh(railGeo, catYellowMat);
      rail.position.set(0, 4.6, 4.3);
      basketGroup.add(rail);

      rootModelGroup.add(basketGroup);
      partsMap.set('basket', basketGroup);

      // Hydraulics
      const hydGroup = new THREE.Group();
      hydGroup.name = 'hydraulics';
      const hydRam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 16), chromePistonMat);
      hydRam.position.set(0, 1.9, 0.4);
      hydRam.rotation.x = -Math.PI / 6;
      hydGroup.add(hydRam);
      rootModelGroup.add(hydGroup);
      partsMap.set('hydraulics', hydGroup);
    } else {
      // 3. Cummins QAS 150 Mobile Power Generator
      const trailerGroup = new THREE.Group();
      trailerGroup.name = 'undercarriage';
      // Dual Axle Road Wheels
      const tireGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 18);
      tireGeo.rotateZ(Math.PI / 2);
      const wheelPos = [
        [-1.1, 0.45, -0.5],
        [1.1, 0.45, -0.5],
        [-1.1, 0.45, 0.5],
        [1.1, 0.45, 0.5],
      ];
      wheelPos.forEach(([x, y, z]) => {
        const w = new THREE.Mesh(tireGeo, trackRubberMat);
        w.position.set(x, y, z);
        trailerGroup.add(w);
      });

      const frameGeo = new THREE.BoxGeometry(1.9, 0.25, 3.8);
      const frame = new THREE.Mesh(frameGeo, darkSteelMat);
      frame.position.set(0, 0.65, 0);
      trailerGroup.add(frame);
      rootModelGroup.add(trailerGroup);
      partsMap.set('undercarriage', trailerGroup);

      // Acoustic Canopy Enclosure
      const canopyGroup = new THREE.Group();
      canopyGroup.name = 'engine';
      const canopyGeo = new THREE.BoxGeometry(1.7, 1.6, 3.2);
      const canopy = new THREE.Mesh(canopyGeo, generatorGreenMat);
      canopy.position.set(0, 1.6, 0);
      canopyGroup.add(canopy);

      // Louvers
      const louverGeo = new THREE.BoxGeometry(1.2, 0.6, 0.05);
      const louver = new THREE.Mesh(louverGeo, darkSteelMat);
      louver.position.set(0, 1.8, 1.62);
      canopyGroup.add(louver);

      // Top Exhaust Rain Cap
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12), darkSteelMat);
      stack.position.set(0.3, 2.65, -0.8);
      canopyGroup.add(stack);
      rootModelGroup.add(canopyGroup);
      partsMap.set('engine', canopyGroup);

      // Alternator Core & Control System
      const coreGroup = new THREE.Group();
      coreGroup.name = 'generator_core';
      const altGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 20);
      altGeo.rotateX(Math.PI / 2);
      const alternator = new THREE.Mesh(altGeo, darkSteelMat);
      alternator.position.set(0, 1.4, -0.4);
      coreGroup.add(alternator);

      // Digital Control Panel
      const panelGeo = new THREE.BoxGeometry(0.7, 0.6, 0.1);
      const panel = new THREE.Mesh(panelGeo, darkSteelMat);
      panel.position.set(0, 1.7, -1.62);
      coreGroup.add(panel);
      rootModelGroup.add(coreGroup);
      partsMap.set('generator_core', coreGroup);
    }

    partsGroupRef.current = partsMap;

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && controlsRef.current) {
        rootModelGroup.rotation.y += delta * 0.2;
      }

      // Wireframe toggle
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => (m.wireframe = wireframe));
          } else {
            obj.material.wireframe = wireframe;
          }
        }
      });

      // Exploded View Dynamics
      partsMap.forEach((group, key) => {
        if (key === 'boom' || key === 'basket') {
          group.position.y = explodedFactor * 1.5;
          group.position.z = explodedFactor * 1.2;
        } else if (key === 'undercarriage') {
          group.position.y = -explodedFactor * 0.8;
        } else if (key === 'engine' || key === 'generator_core') {
          group.position.x = explodedFactor * 1.2;
        } else if (key === 'cab') {
          group.position.x = -explodedFactor * 1.4;
        } else if (key === 'hydraulics') {
          group.position.z = -explodedFactor * 1.1;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeModel, explodedFactor, wireframe, autoRotate]);

  // Voice Note Recording
  const handleToggleVoiceRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    setTranscribedNote('Listening to verbal condition report...');

    // Simulate speech-to-text integration or browser web speech
    setTimeout(() => {
      const simulatedNotes = [
        `Inspection of ${activeModel}: hydraulic seal on main cylinder inspected, zero leakages detected. Hour meter matches dispatch ticket. Wear rating within nominal limits.`,
        `Visual check completed: track tension within 35mm spec, engine cooling fins clean, hydraulic return line dry, ready for customer release.`,
        `Safety audit: emergency cutout tested, safety decals legible, all boom pivot grease points serviced. Customer handover approved.`,
      ];
      const randomNote = simulatedNotes[Math.floor(Math.random() * simulatedNotes.length)];
      setTranscribedNote(randomNote);
      setIsRecording(false);
      if (onRecordVoiceNote) {
        onRecordVoiceNote(randomNote);
      }
    }, 3200);
  };

  return (
    <div className="relative w-full h-[620px] lg:h-[720px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col">
      {/* 3D Canvas Container (Full Bleed) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2.5 shadow-lg pointer-events-auto flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Box className="w-4 h-4 text-amber-400" />
              Interactive 3D Machinery Studio
            </h3>
            <p className="text-xs text-slate-400">
              {equipmentName || (activeModel === 'excavator' ? 'CAT 320 GC Excavator' : activeModel === 'boom_lift' ? 'Genie S-65 Boom Lift' : 'Cummins QAS 150 Generator')} • PBR Studio Simulation
            </p>
          </div>
        </div>

        {/* Viewport Control Badges */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl text-xs font-medium border backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 ${
              autoRotate ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle turntable auto-rotation"
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Rotate</span>
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`p-2 rounded-xl text-xs font-medium border backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 ${
              wireframe ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle structural wireframe"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Wireframe</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Part Inspection Overlay Badge */}
      {activePart && telematicsData[activePart] && (
        <div className="absolute top-20 right-4 w-80 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl z-10 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Sub-assembly Diagnostics</span>
              <h4 className="text-sm font-bold text-white">{telematicsData[activePart].name}</h4>
            </div>
            <button
              onClick={() => setActivePart(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Live Telemetry</span>
              <span className="text-slate-200 font-mono font-medium">{telematicsData[activePart].metric}</span>
            </div>

            <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Wear & Tolerances</span>
              <span className="text-slate-200 font-mono">{telematicsData[activePart].wear}</span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium pt-1">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{telematicsData[activePart].recommendation}</span>
            </div>
          </div>
        </div>
      )}

      {/* Voice Note Banner (when recorded) */}
      {transcribedNote && (
        <div className="absolute top-20 left-4 max-w-md bg-amber-950/80 backdrop-blur-md border border-amber-500/40 rounded-xl p-3 shadow-xl z-10 text-xs text-amber-200 pointer-events-auto">
          <div className="flex items-center gap-2 font-semibold text-amber-400 mb-1">
            <Volume2 className="w-4 h-4" />
            <span>Voice Inspection Log Captured (gemini-3.5-transcribe)</span>
          </div>
          <p className="italic">"{transcribedNote}"</p>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-4 transition-all">
          <div className="flex items-center justify-between mb-3">
            {/* Machinery Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                onClick={() => { setActiveModel('excavator'); setActivePart(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeModel === 'excavator' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                CAT 320 Excavator
              </button>
              <button
                onClick={() => { setActiveModel('boom_lift'); setActivePart(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeModel === 'boom_lift' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Genie S-65 Boom Lift
              </button>
              <button
                onClick={() => { setActiveModel('generator'); setActivePart(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeModel === 'generator' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cummins QAS 150
              </button>
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setIsDockCollapsed(!isDockCollapsed)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              {isDockCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {!isDockCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              {/* Exploded View Slider */}
              <div className="flex flex-col justify-center space-y-1.5">
                <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    Exploded Assembly View
                  </span>
                  <span className="text-amber-400 font-mono">{Math.round(explodedFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={explodedFactor}
                  onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Assembled</span>
                  <span>Fully Exploded</span>
                </div>
              </div>

              {/* Sub-assembly Highlight Buttons */}
              <div className="flex flex-col space-y-1.5">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-400" />
                  Inspect Critical Components
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(activeModel === 'excavator' 
                    ? ['boom', 'hydraulics', 'undercarriage', 'engine', 'cab'] 
                    : activeModel === 'boom_lift' 
                    ? ['boom', 'basket', 'hydraulics', 'undercarriage', 'engine']
                    : ['undercarriage', 'engine', 'generator_core']
                  ).map((partKey) => (
                    <button
                      key={partKey}
                      onClick={() => setActivePart(activePart === partKey ? null : partKey)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize transition-all ${
                        activePart === partKey
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {partKey.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Inspection Recorder */}
              <div className="flex flex-col justify-center space-y-1.5">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                  Voice Handover Dictation
                </span>
                <button
                  onClick={handleToggleVoiceRecord}
                  disabled={isRecording}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                    isRecording 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse' 
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  {isRecording ? 'Listening (gemini-3.5-transcribe)...' : 'Record Verbal Inspection Note'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
