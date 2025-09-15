import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Add fog for depth perception
scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Drone properties
const droneState = {
    position: new THREE.Vector3(0, 5, 0),
    rotation: new THREE.Euler(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotationVelocity: new THREE.Vector3(0, 0, 0),
    propellerRotation: 0,
    beginnerMode: false,
    mouseX: 0,
    mouseY: 0,
    // Physics properties
    mass: 2.0, // kg
    gravity: 9.8, // m/s²
    maxThrustPerMotor: 8.0, // N per motor (4 motors total = 32N max)
    dragCoefficient: 0.1,
    liftCoefficient: 0.05,
    totalThrust: 0,
    motorThrusts: [0, 0, 0, 0], // Thrust in Newtons for each motor
    motorSpeeds: [0, 0, 0, 0], // RPM for each motor (for display)
    batteryLevel: 100, // percentage
    temperature: 25, // Celsius
    pressure: 1013.25, // hPa
    windSpeed: new THREE.Vector3(0, 0, 0),
    gForce: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    weight: 19.6, // Weight in Newtons (mass * gravity = 2kg * 9.8m/s²)
    hoverMode: false,
    batteryLevel: 100, // percentage
    batteryDrainRate: 0.001, // base drain per frame (reduced by 10x)
    motorLoad: 0 // current motor load for battery calculation
};

// Mouse lock and movement handling
let isPointerLocked = false;

// Request pointer lock when clicking on the game
document.addEventListener('click', () => {
    if (!isPointerLocked) {
        document.body.requestPointerLock();
    }
});

// Handle pointer lock change
document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === document.body;
});

// Mouse movement handler using pointer lock
document.addEventListener('mousemove', (event) => {
    if (isPointerLocked && droneState.beginnerMode) {
        // Use movementX/Y for relative mouse movement with inverted horizontal controls
        droneState.mouseX -= event.movementX * 0.0005;  // Inverted horizontal movement
        droneState.mouseY -= event.movementY * 0.0005;  // Vertical stays the same
    } else if (!droneState.beginnerMode) {
        // Normal mode - reset mouse position
        droneState.mouseX = 0;
        droneState.mouseY = 0;
    }
});

// Create drone model
const droneBody = new THREE.Group();

// Main body
const bodyGeometry = new THREE.BoxGeometry(1, 0.2, 1);
const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
droneBody.add(body);

// Arms for propellers
const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
const armMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });

// Create 4 arms
const armPositions = [
    { x: 0.4, z: 0.4, rotation: Math.PI / 4 },
    { x: -0.4, z: 0.4, rotation: -Math.PI / 4 },
    { x: 0.4, z: -0.4, rotation: -Math.PI / 4 },
    { x: -0.4, z: -0.4, rotation: Math.PI / 4 }
];

armPositions.forEach(pos => {
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(pos.x, 0, pos.z);
    arm.rotation.y = pos.rotation;
    droneBody.add(arm);
});

// Propellers
const propellerGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.05);
const propellerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

// Create 4 propellers
const propellers = armPositions.map(pos => {
    const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
    propeller.position.set(pos.x, 0.1, pos.z);
    return propeller;
});

propellers.forEach(propeller => droneBody.add(propeller));
scene.add(droneBody);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Create clouds
const clouds = [];
for (let i = 0; i < 50; i++) {
    const cloudGeometry = new THREE.SphereGeometry(Math.random() * 3 + 2, 8, 8);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        flatShading: true
    });
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    
    // Position clouds randomly in the sky
    cloud.position.set(
        Math.random() * 200 - 100,
        Math.random() * 30 + 20,
        Math.random() * 200 - 100
    );
    cloud.scale.y = 0.5; // Flatten clouds
    clouds.push(cloud);
    scene.add(cloud);
}

// Motion trails
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
});
const trailPositions = new Float32Array(300); // Store 100 points with x,y,z each
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);
let trailIndex = 0;

// Create environment
const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
const groundMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x1a472a,
    wireframe: false,
    side: THREE.DoubleSide,
    shininess: 10,
    flatShading: true
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;

// Add terrain variation
const vertices = ground.geometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
    if (i !== 1) {
        vertices[i + 1] = Math.sin(i * 0.1) * Math.cos(i * 0.1) * 3;
    }
}
ground.geometry.attributes.position.needsUpdate = true;
scene.add(ground);

// Add buildings/obstacles
const buildingCount = 20;
for (let i = 0; i < buildingCount; i++) {
    const height = Math.random() * 20 + 10;
    const width = Math.random() * 8 + 4;
    const buildingGeometry = new THREE.BoxGeometry(width, height, width);
    const buildingMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7)
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    
    // Position buildings in a circular pattern
    const radius = Math.random() * 50 + 20;
    const angle = (i / buildingCount) * Math.PI * 2;
    building.position.set(
        Math.cos(angle) * radius,
        height / 2,
        Math.sin(angle) * radius
    );
    scene.add(building);
}

// Add floating rings as challenges in a specific path
const ringCount = 10;
const rings = [];
const ringPositions = [
    { x: 0, y: 10, z: -20 },
    { x: 10, y: 15, z: -30 },
    { x: 20, y: 10, z: -20 },
    { x: 20, y: 8, z: 0 },
    { x: 10, y: 12, z: 10 },
    { x: -10, y: 15, z: 10 },
    { x: -20, y: 10, z: 0 },
    { x: -20, y: 8, z: -10 },
    { x: -10, y: 12, z: -20 },
    { x: 0, y: 15, z: -10 }
];

// Create rings and arrows
for (let i = 0; i < ringCount; i++) {
    const ringGeometry = new THREE.TorusGeometry(2, 0.1, 16, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Position rings in predefined positions
    ring.position.set(
        ringPositions[i].x,
        ringPositions[i].y,
        ringPositions[i].z
    );
    
    // Rotate rings to face next ring
    if (i < ringCount - 1) {
        const nextPos = ringPositions[i + 1];
        ring.lookAt(nextPos.x, nextPos.y, nextPos.z);
    }
    
    rings.push(ring);
    scene.add(ring);

    // Add arrow pointing to next ring
    if (i < ringCount - 1) {
        const nextPos = ringPositions[i + 1];
        const direction = new THREE.Vector3(
            nextPos.x - ringPositions[i].x,
            nextPos.y - ringPositions[i].y,
            nextPos.z - ringPositions[i].z
        );
        const length = direction.length() * 0.3; // Arrow length is 30% of distance between rings
        const arrowHelper = new THREE.ArrowHelper(
            direction.normalize(),
            ring.position,
            length,
            0xff0000,
            length * 0.2,
            length * 0.1
        );
        scene.add(arrowHelper);
    }
}

// Add timer variables
let timerStarted = false;
let startTime = 0;
let ringsCollected = 0;

// Controls
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    Shift: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        keys.Space = true;
    } else {
        keys[e.key] = true;
    }
    if (e.key.toLowerCase() === 'b') {
        droneState.beginnerMode = !droneState.beginnerMode;
        // Reset velocities when switching modes
        resetVelocities();
        // Update mode display
        document.getElementById('mode-display').textContent = 
            droneState.beginnerMode ? 'Beginner Mode' : 'Normal Mode';
    }
    if (e.key.toLowerCase() === 'h') {
        droneState.hoverMode = !droneState.hoverMode;
        // Update hover mode display
        document.getElementById('hover-display').textContent = 
            droneState.hoverMode ? 'Hover: ON' : 'Hover: OFF';
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        keys.Space = false;
    } else {
        keys[e.key] = false;
    }
});

// Physics constants
const BASE_MOTOR_THRUST = 2.0; // Base thrust per motor in Newtons
const ROTATION_SPEED = 0.05;
const DRAG = 0.98;  // Air resistance (closer to 1 for more realistic physics)
const PROPELLER_SPEED = 0.5;
const PHYSICS_SCALE = 0.01; // Scale factor to make physics work in our 3D world
const AIR_DENSITY = 1.225; // kg/m³ at sea level
const GROUND_LEVEL = 0.5; // Ground collision level

// Thrust multiplier (can be adjusted by user)
let thrustMultiplier = 1.0;

// Setup thrust control slider
const thrustSlider = document.getElementById('thrust-slider');
const thrustValue = document.getElementById('thrust-value');

thrustSlider.addEventListener('input', (e) => {
    thrustMultiplier = parseFloat(e.target.value);
    thrustValue.textContent = thrustMultiplier.toFixed(1) + 'x';
});

// Function to stop all movement
function resetVelocities() {
    droneState.velocity.set(0, 0, 0);
    droneState.rotationVelocity.set(0, 0, 0);
    droneState.currentThrust = 0;
    droneState.motorSpeeds = [0, 0, 0, 0];
}

// Physics calculation functions
function calculateDrag(velocity) {
    const speed = velocity.length();
    const dragMagnitude = 0.5 * AIR_DENSITY * droneState.dragCoefficient * speed * speed;
    const dragForce = velocity.clone().normalize().multiplyScalar(-dragMagnitude * 0.001);
    return dragForce;
}

function calculateLift(velocity, rotation) {
    // Simplified lift calculation based on forward velocity and pitch
    const forwardSpeed = Math.abs(velocity.z);
    const pitchAngle = rotation.x;
    const liftMagnitude = 0.5 * AIR_DENSITY * droneState.liftCoefficient * forwardSpeed * Math.sin(pitchAngle);
    return new THREE.Vector3(0, liftMagnitude * 0.001, 0);
}

function updatePhysicsHUD() {
    // Position
    document.getElementById('pos-x').textContent = droneState.position.x.toFixed(1);
    document.getElementById('pos-y').textContent = droneState.position.y.toFixed(1);
    document.getElementById('pos-z').textContent = droneState.position.z.toFixed(1);
    document.getElementById('altitude').textContent = Math.max(0, droneState.position.y).toFixed(1) + 'm';
    
    // Velocity
    const speed = droneState.velocity.length() / PHYSICS_SCALE; // Convert to realistic scale
    document.getElementById('speed').textContent = speed.toFixed(1) + ' m/s';
    document.getElementById('vel-x').textContent = (droneState.velocity.x / PHYSICS_SCALE).toFixed(2);
    document.getElementById('vel-y').textContent = (droneState.velocity.y / PHYSICS_SCALE).toFixed(2);
    document.getElementById('vel-z').textContent = (droneState.velocity.z / PHYSICS_SCALE).toFixed(2);
    
    // Attitude (convert radians to degrees)
    const pitch = (droneState.rotation.x * 180 / Math.PI);
    const yaw = (droneState.rotation.y * 180 / Math.PI);
    const roll = (droneState.rotation.z * 180 / Math.PI);
    
    document.getElementById('pitch').textContent = pitch.toFixed(1) + '°';
    document.getElementById('yaw').textContent = yaw.toFixed(1) + '°';
    document.getElementById('roll').textContent = roll.toFixed(1) + '°';
    
    // Forces
    document.getElementById('thrust').textContent = droneState.totalThrust.toFixed(1) + ' N';
    
    const dragForce = calculateDrag(droneState.velocity);
    document.getElementById('drag').textContent = (dragForce.length() / PHYSICS_SCALE).toFixed(1) + ' N';
    
    const liftForce = calculateLift(droneState.velocity, droneState.rotation);
    document.getElementById('lift').textContent = (liftForce.y / PHYSICS_SCALE).toFixed(1) + ' N';
    
    // Update attitude indicator
    const horizonLine = document.getElementById('horizon-line');
    if (horizonLine) {
        horizonLine.style.transform = `translateX(-50%) translateY(-50%) rotate(${-roll}deg) translateY(${pitch * 2}px)`;
    }
    
    // Color coding for warnings
    const speedElement = document.getElementById('speed');
    if (speed > 15) {
        speedElement.className = 'hud-number danger';
    } else if (speed > 10) {
        speedElement.className = 'hud-number warning';
    } else {
        speedElement.className = 'hud-number';
    }
    
    const altElement = document.getElementById('altitude');
    if (droneState.position.y < 1) {
        altElement.className = 'hud-number danger';
    } else if (droneState.position.y < 3) {
        altElement.className = 'hud-number warning';
    } else {
        altElement.className = 'hud-number';
    }
    
    // Update individual motor thrust values
    document.getElementById('motor1-thrust').textContent = droneState.motorThrusts[0].toFixed(1) + ' N';
    document.getElementById('motor2-thrust').textContent = droneState.motorThrusts[1].toFixed(1) + ' N';
    document.getElementById('motor3-thrust').textContent = droneState.motorThrusts[2].toFixed(1) + ' N';
    document.getElementById('motor4-thrust').textContent = droneState.motorThrusts[3].toFixed(1) + ' N';
    
    // Color code thrust vs weight
    const thrustElement = document.getElementById('thrust');
    if (droneState.totalThrust > droneState.weight) {
        thrustElement.className = 'hud-number'; // Normal - can climb
    } else if (droneState.totalThrust > droneState.weight * 0.8) {
        thrustElement.className = 'hud-number warning'; // Warning - marginal
    } else {
        thrustElement.className = 'hud-number danger'; // Danger - will fall
    }
    
    // Update battery level
    document.getElementById('battery').textContent = droneState.batteryLevel.toFixed(1) + '%';
    
    // Color code battery level
    const batteryElement = document.getElementById('battery');
    if (droneState.batteryLevel < 10) {
        batteryElement.className = 'hud-number danger';
    } else if (droneState.batteryLevel < 25) {
        batteryElement.className = 'hud-number warning';
    } else {
        batteryElement.className = 'hud-number';
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Reset motor thrusts for this frame
    droneState.motorThrusts = [0, 0, 0, 0];
    droneState.motorSpeeds = [0, 0, 0, 0];
    droneState.totalThrust = 0;

    // Calculate required hover thrust (thrust needed to counteract weight)
    const hoverThrustRequired = droneState.weight; // 19.6N to counteract 19.6N weight
    let hasInput = false;

    // Update drone physics based on mode
    if (droneState.beginnerMode) {
        // Calculate target rotations with full range of motion
        const targetRotationX = droneState.mouseY * Math.PI;  // Full range pitch
        const targetRotationY = droneState.mouseX * Math.PI * 2;  // Full 360-degree yaw
        
        // Smoothly rotate the drone to face mouse position
        droneState.rotation.x = targetRotationX;
        droneState.rotation.y = targetRotationY;
        
        // Allow some banking for more dynamic movement
        droneState.rotation.z = -droneState.mouseX * 0.5;  // Bank slightly in turns
        
        // W key controls throttle in beginner mode - moves in direction of crosshair
        if (keys.w) {
            const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier;
            droneState.motorThrusts = [thrustPerMotor, thrustPerMotor, thrustPerMotor, thrustPerMotor];
            droneState.totalThrust = thrustPerMotor * 4;
            
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyEuler(droneState.rotation);
            const thrustForce = direction.multiplyScalar(droneState.totalThrust * PHYSICS_SCALE);
            droneState.velocity.add(thrustForce);
            droneState.motorSpeeds = [3000, 3000, 3000, 3000];
            hasInput = true;
        }
    } else {
        // Normal mode controls
        if (keys.w) {
            const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier * 0.5;
            droneState.motorThrusts[0] += thrustPerMotor;
            droneState.motorThrusts[1] += thrustPerMotor;
            droneState.velocity.z -= Math.cos(droneState.rotation.y) * thrustPerMotor * PHYSICS_SCALE;
            droneState.motorSpeeds[0] += 1500;
            droneState.motorSpeeds[1] += 1500;
            hasInput = true;
        }
        if (keys.s) {
            const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier * 0.5;
            droneState.motorThrusts[2] += thrustPerMotor;
            droneState.motorThrusts[3] += thrustPerMotor;
            droneState.velocity.z += Math.cos(droneState.rotation.y) * thrustPerMotor * PHYSICS_SCALE;
            droneState.motorSpeeds[2] += 1500;
            droneState.motorSpeeds[3] += 1500;
            hasInput = true;
        }
        if (keys.a) {
            const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier * 0.3;
            droneState.motorThrusts[1] += thrustPerMotor;
            droneState.motorThrusts[3] += thrustPerMotor;
            droneState.velocity.x -= thrustPerMotor * PHYSICS_SCALE;
            droneState.motorSpeeds[1] += 1000;
            droneState.motorSpeeds[3] += 1000;
            hasInput = true;
        }
        if (keys.d) {
            const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier * 0.3;
            droneState.motorThrusts[0] += thrustPerMotor;
            droneState.motorThrusts[2] += thrustPerMotor;
            droneState.velocity.x += thrustPerMotor * PHYSICS_SCALE;
            droneState.motorSpeeds[0] += 1000;
            droneState.motorSpeeds[2] += 1000;
            hasInput = true;
        }
        if (keys.ArrowUp) droneState.rotationVelocity.x -= ROTATION_SPEED;
        if (keys.ArrowDown) droneState.rotationVelocity.x += ROTATION_SPEED;
    }

    // Vertical controls work the same in both modes
    if (keys.Space) {
        const thrustPerMotor = BASE_MOTOR_THRUST * thrustMultiplier;
        droneState.motorThrusts = droneState.motorThrusts.map(thrust => thrust + thrustPerMotor);
        droneState.velocity.y += thrustPerMotor * 4 * PHYSICS_SCALE;
        droneState.motorSpeeds = droneState.motorSpeeds.map(speed => speed + 2000);
        hasInput = true;
    }
    if (keys.Shift) {
        const thrustReduction = BASE_MOTOR_THRUST * thrustMultiplier * 0.5;
        droneState.velocity.y -= thrustReduction * PHYSICS_SCALE;
        droneState.motorSpeeds = droneState.motorSpeeds.map(speed => Math.max(0, speed - 1000));
        hasInput = true;
    }
    
    // Calculate total thrust from all motors
    droneState.totalThrust = droneState.motorThrusts.reduce((sum, thrust) => sum + thrust, 0);
    
    // Calculate battery drain based on motor usage
    droneState.motorLoad = droneState.totalThrust / (BASE_MOTOR_THRUST * 4); // Normalized load (0-1)
    const batteryDrain = droneState.batteryDrainRate * (1 + droneState.motorLoad * 2); // More thrust = more drain
    droneState.batteryLevel = Math.max(0, droneState.batteryLevel - batteryDrain);
    
    // If battery is dead, disable all thrust
    if (droneState.batteryLevel <= 0) {
        droneState.motorThrusts = [0, 0, 0, 0];
        droneState.totalThrust = 0;
        droneState.motorSpeeds = [0, 0, 0, 0];
    }
    
    // Apply gravity
    const gravityForce = new THREE.Vector3(0, -droneState.weight * PHYSICS_SCALE, 0);
    droneState.velocity.add(gravityForce);
    
    // Calculate and apply drag
    const dragForce = calculateDrag(droneState.velocity);
    droneState.velocity.add(dragForce);
    
    // Calculate and apply lift
    const liftForce = calculateLift(droneState.velocity, droneState.rotation);
    droneState.velocity.add(liftForce);
    
    // Ground collision detection
    if (droneState.position.y <= GROUND_LEVEL) {
        droneState.position.y = GROUND_LEVEL;
        droneState.velocity.y = Math.max(0, droneState.velocity.y); // Stop downward velocity
        
        // Add some bounce/damping when hitting ground
        droneState.velocity.multiplyScalar(0.3);
        droneState.rotationVelocity.multiplyScalar(0.5);
    }
    
    // Simulate battery drain
    const totalMotorLoad = droneState.motorSpeeds.reduce((sum, speed) => sum + speed, 0);
    droneState.batteryLevel -= totalMotorLoad * 0.000001;
    droneState.batteryLevel = Math.max(0, droneState.batteryLevel);
    
    // Update temperature based on motor usage
    droneState.temperature = 25 + (totalMotorLoad * 0.00001);
    
    // Calculate G-forces
    const prevVelocity = droneState.velocity.clone();
    droneState.gForce.copy(droneState.velocity).sub(prevVelocity).multiplyScalar(1 / PHYSICS_SCALE);

    // Update motion trail
    const positions = trail.geometry.attributes.position.array;
    positions[trailIndex * 3] = droneState.position.x;
    positions[trailIndex * 3 + 1] = droneState.position.y;
    positions[trailIndex * 3 + 2] = droneState.position.z;
    trailIndex = (trailIndex + 1) % 100;
    trail.geometry.attributes.position.needsUpdate = true;

    // Animate clouds
    clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(Date.now() * 0.001 + i) * 0.05;
        cloud.position.z += Math.cos(Date.now() * 0.001 + i) * 0.05;
    });

    // Rotate propellers
    droneState.propellerRotation += PROPELLER_SPEED;
    propellers.forEach((propeller, index) => {
        propeller.rotation.y = droneState.propellerRotation + (index % 2 ? Math.PI : 0);
    });

    // Apply physics
    droneState.position.add(droneState.velocity);
    droneState.rotation.x += droneState.rotationVelocity.x;
    droneState.rotation.y += droneState.rotationVelocity.y;
    droneState.rotation.z += droneState.rotationVelocity.z;

    // Apply drag and handle no input
    droneState.velocity.multiplyScalar(DRAG);
    droneState.rotationVelocity.x *= DRAG;
    droneState.rotationVelocity.y *= DRAG;
    droneState.rotationVelocity.z *= DRAG;

    // If velocity is very small, stop completely to prevent drift
    if (droneState.velocity.length() < 0.001) {
        droneState.velocity.set(0, 0, 0);
    }
    if (Math.abs(droneState.rotationVelocity.x) < 0.001 &&
        Math.abs(droneState.rotationVelocity.y) < 0.001 &&
        Math.abs(droneState.rotationVelocity.z) < 0.001) {
        droneState.rotationVelocity.set(0, 0, 0);
    }

    // Update drone position and rotation
    droneBody.position.copy(droneState.position);
    droneBody.rotation.copy(droneState.rotation);
    
    // Update physics HUD
    updatePhysicsHUD();

    // Update camera position based on mode
    if (droneState.beginnerMode) {
        // In beginner mode, camera follows drone's rotation exactly
        const cameraOffset = new THREE.Vector3(0, 0, 2);  // 2 units behind
        cameraOffset.applyEuler(droneState.rotation);
        camera.position.copy(droneState.position).add(cameraOffset);
        
        // Look in the direction the drone is facing
        const lookAtPoint = new THREE.Vector3();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyEuler(droneState.rotation);
        lookAtPoint.copy(droneState.position).add(forward);
        camera.lookAt(lookAtPoint);
    } else {
        // Normal mode - camera stays above
        camera.position.set(
            droneState.position.x,
            droneState.position.y + 2,
            droneState.position.z
        );

    }
  
  
   
    // Auto-hover: Apply hover thrust when no input (realistic physics)
    if (droneState.hoverMode && droneState.position.y > GROUND_LEVEL + 1 && droneState.batteryLevel > 0) {
        const hoverThrustPerMotor = hoverThrustRequired / 4; // Distribute across 4 motors
        droneState.motorThrusts = [hoverThrustPerMotor, hoverThrustPerMotor, hoverThrustPerMotor, hoverThrustPerMotor];
        droneState.totalThrust = hoverThrustRequired;
        droneState.velocity.y += hoverThrustRequired * PHYSICS_SCALE;
        droneState.motorSpeeds = [2000, 2000, 2000, 2000];
    }
    

    // Check for ring collisions and update timer
    rings.forEach((ring, i) => {
        if (ring.visible) {  // Only check visible rings
            const distance = droneState.position.distanceTo(ring.position);
            if (distance < 2) {  // If drone is close enough to ring
                ring.visible = false;  // Hide the ring
                ringsCollected++;
                
                if (!timerStarted) {
                    timerStarted = true;
                    startTime = Date.now();
                }
                
                if (ringsCollected === ringCount) {
                    const endTime = Date.now();
                    const totalTime = ((endTime - startTime) / 1000).toFixed(1);
                    document.getElementById('timer').textContent = `Completed in: ${totalTime}s`;
                }
            }
        }
    });

    // Update timer if race is in progress
    if (timerStarted && ringsCollected < ringCount) {
        const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
        document.getElementById('timer').textContent = `Time: ${currentTime}s`;
    }

    // Animate remaining rings
    rings.forEach((ring, i) => {
        if (ring.visible) {
            ring.rotation.y += 0.01;
            ring.position.y += Math.sin(Date.now() * 0.001 + i) * 0.02;
        }
    });

    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(); 