import React, { useEffect, useRef, useState } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Planet {
  name: string;
  orbitRadiusX: number;
  orbitRadiusY: number;
  tilt: number;
  angle: number;
  speed: number;
  radius: number;
  color: string;
  hasRings?: boolean;
  ringColor?: string;
  moons?: { radius: number; dist: number; angle: number; speed: number; color: string }[];
  aiLabel?: string;
}

interface Satellite {
  id: string;
  orbitRadiusX: number;
  orbitRadiusY: number;
  angle: number;
  speed: number;
  color: string;
  beaconTimer: number;
  pulseTimer: number;
  name: string;
}

interface Spaceship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  scale: number;
  trail: { x: number; y: number; alpha: number }[];
  color: string;
}

export const FuturisticCosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ambientActive, setAmbientActive] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 1. Estrelas
    const starCount = Math.min(160, Math.floor((width * height) / 9000));
    const stars: Star[] = [];
    const starColors = ['#ffffff', '#bae6fd', '#e0e7ff', '#fef08a', '#c084fc', '#67e8f9'];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.6,
        baseAlpha: Math.random() * 0.6 + 0.25,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        phase: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    // 2. Estrelas Cadentes
    const shootingStars: ShootingStar[] = [];
    let shootingStarCooldown = 120;

    // 3. Sistema Planetário
    const planets: Planet[] = [
      {
        name: 'Cyber-Mercurius (IA Node α)',
        orbitRadiusX: 180,
        orbitRadiusY: 100,
        tilt: 0.15,
        angle: 0.4,
        speed: 0.0035,
        radius: 7,
        color: '#f59e0b',
        aiLabel: 'IA α-Core',
      },
      {
        name: 'Terra Quantum (Hub HASPAHO)',
        orbitRadiusX: 320,
        orbitRadiusY: 180,
        tilt: 0.15,
        angle: 2.1,
        speed: 0.0022,
        radius: 12,
        color: '#38bdf8',
        moons: [
          { radius: 2.5, dist: 24, angle: 0, speed: 0.04, color: '#fef08a' },
        ],
        aiLabel: 'Gemini Orbital',
      },
      {
        name: 'Chronos Cibernético (Gas Giant)',
        orbitRadiusX: 490,
        orbitRadiusY: 270,
        tilt: 0.15,
        angle: 4.3,
        speed: 0.0014,
        radius: 19,
        color: '#c084fc',
        hasRings: true,
        ringColor: 'rgba(216, 180, 254, 0.45)',
        moons: [
          { radius: 2, dist: 34, angle: 1.2, speed: 0.03, color: '#a7f3d0' },
          { radius: 1.8, dist: 46, angle: 3.8, speed: 0.02, color: '#bae6fd' },
        ],
        aiLabel: 'Neural Ring',
      },
      {
        name: 'Aegis Sentinel (Outer Guard)',
        orbitRadiusX: 680,
        orbitRadiusY: 370,
        tilt: 0.15,
        angle: 5.7,
        speed: 0.0008,
        radius: 14,
        color: '#fb7185',
        aiLabel: 'Quantum Vector',
      },
    ];

    // 4. Satélites Artificiais com feixes de dados de IA
    const satellites: Satellite[] = [
      {
        id: 'sat-1',
        orbitRadiusX: 240,
        orbitRadiusY: 130,
        angle: 1.0,
        speed: 0.005,
        color: '#34d399',
        beaconTimer: 0,
        pulseTimer: 0,
        name: 'SAT-GEMINI 01',
      },
      {
        id: 'sat-2',
        orbitRadiusX: 410,
        orbitRadiusY: 220,
        angle: 3.5,
        speed: 0.003,
        color: '#38bdf8',
        beaconTimer: 0.5,
        pulseTimer: 0.3,
        name: 'RELAY-HASPAHO',
      },
      {
        id: 'sat-3',
        orbitRadiusX: 590,
        orbitRadiusY: 320,
        angle: 5.1,
        speed: 0.002,
        color: '#f43f5e',
        beaconTimer: 0.2,
        pulseTimer: 0.7,
        name: 'AI-SYNAPSE IX',
      },
    ];

    // 5. Espaçonaves Futuristas
    const spaceships: Spaceship[] = [
      {
        x: -50,
        y: height * 0.25,
        vx: 1.1,
        vy: 0.35,
        angle: Math.atan2(0.35, 1.1),
        scale: 1,
        trail: [],
        color: '#38bdf8',
      },
      {
        x: width + 50,
        y: height * 0.65,
        vx: -0.9,
        vy: -0.28,
        angle: Math.atan2(-0.28, -0.9),
        scale: 0.85,
        trail: [],
        color: '#f59e0b',
      },
      {
        x: width * 0.15,
        y: height + 60,
        vx: 0.7,
        vy: -1.2,
        angle: Math.atan2(-1.2, 0.7),
        scale: 0.75,
        trail: [],
        color: '#c084fc',
      },
    ];

    let time = 0;

    const render = () => {
      time += 0.016;

      // Limpa e desenha o gradiente de espaço profundo e infinito (Deep Dark Infinite Space)
      const spaceGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        40,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.95
      );
      spaceGrad.addColorStop(0, '#0a1026');
      spaceGrad.addColorStop(0.35, '#060a17');
      spaceGrad.addColorStop(0.7, '#03050c');
      spaceGrad.addColorStop(1, '#010206');

      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Nebulosa Cósmica de Espaço Profundo (Cyan Elétrico & Violeta & Magenta)
      ctx.save();
      const nebula1 = ctx.createRadialGradient(width * 0.75, height * 0.25, 20, width * 0.75, height * 0.25, 520);
      nebula1.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      nebula1.addColorStop(0.4, 'rgba(99, 102, 241, 0.14)');
      nebula1.addColorStop(0.8, 'rgba(14, 165, 233, 0.05)');
      nebula1.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(width * 0.22, height * 0.72, 30, width * 0.22, height * 0.72, 560);
      nebula2.addColorStop(0, 'rgba(192, 132, 252, 0.20)');
      nebula2.addColorStop(0.5, 'rgba(244, 63, 94, 0.10)');
      nebula2.addColorStop(0.8, 'rgba(168, 85, 247, 0.04)');
      nebula2.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      const nebula3 = ctx.createRadialGradient(width * 0.5, height * 0.9, 10, width * 0.5, height * 0.9, 400);
      nebula3.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      nebula3.addColorStop(0.6, 'rgba(6, 182, 212, 0.06)');
      nebula3.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula3;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Desenha Estrelas Cintilantes
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.phase);
        const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + twinkle * 0.35));
        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Cruz de brilho para estrelas maiores
        if (star.size > 1.8 && alpha > 0.6) {
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x - star.size * 2.5, star.y);
          ctx.lineTo(star.x + star.size * 2.5, star.y);
          ctx.moveTo(star.x, star.y - star.size * 2.5);
          ctx.lineTo(star.x, star.y + star.size * 2.5);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      // Conexões Neurais de IA entre estrelas próximas (Constelação Inteligente)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.lineWidth = 0.6;
      for (let i = 0; i < stars.length; i += 3) {
        for (let j = i + 1; j < Math.min(i + 6, stars.length); j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 95) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }

      // Estrelas cadentes
      shootingStarCooldown--;
      if (shootingStarCooldown <= 0) {
        shootingStars.push({
          x: Math.random() * width * 0.8 + width * 0.1,
          y: Math.random() * height * 0.4,
          vx: -(Math.random() * 4 + 5),
          vy: Math.random() * 2.5 + 2.5,
          len: Math.random() * 60 + 50,
          alpha: 1,
          life: 0,
          maxLife: 35,
        });
        shootingStarCooldown = Math.floor(Math.random() * 160 + 100);
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        const p = ss.life / ss.maxLife;
        const currentAlpha = (1 - p) * 0.85;

        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 6, ss.y - ss.vy * 6);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.3, 'rgba(56, 189, 248, 0.6)');
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * (ss.len / 10), ss.y - ss.vy * (ss.len / 10));
        ctx.stroke();

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(i, 1);
        }
      }

      // ==========================================
      // CENTRO DO SISTEMA: NÚCLEO SOLAR DE IA (GEMINI NEURAL STAR)
      // ==========================================
      const centerX = width * 0.5;
      const centerY = height * 0.48;

      // Halo e Corona Solar de IA
      const sunCorona = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 80);
      sunCorona.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunCorona.addColorStop(0.2, 'rgba(250, 204, 21, 0.7)');
      sunCorona.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
      sunCorona.addColorStop(0.8, 'rgba(56, 189, 248, 0.12)');
      sunCorona.addColorStop(1, 'transparent');

      ctx.fillStyle = sunCorona;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.fill();

      // Esfera Solar Central com Pulsação
      const sunPulse = Math.sin(time * 2) * 2;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 22 + sunPulse, 0, Math.PI * 2);
      ctx.fill();

      // Anéis holográficos de IA ao redor do núcleo
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 34 + Math.sin(time) * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.3)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 44 + Math.cos(time) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Selo de IA no centro da estrela
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦ IA', centerX, centerY);

      // ==========================================
      // ÓRBITAS ELÍPTICAS FUTURISTAS & PLANETAS
      // ==========================================
      planets.forEach((p) => {
        // Desenha a trajetória orbital
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, p.orbitRadiusX, p.orbitRadiusY, p.tilt, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Atualiza ângulo do planeta
        p.angle += p.speed;

        // Posição no espaço elíptico
        const px = centerX + Math.cos(p.angle) * p.orbitRadiusX;
        const py = centerY + Math.sin(p.angle) * p.orbitRadiusY;

        // Brilho atmosférico do planeta
        const pGlow = ctx.createRadialGradient(px, py, 1, px, py, p.radius * 2);
        pGlow.addColorStop(0, p.color);
        pGlow.addColorStop(0.6, p.color);
        pGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = pGlow;
        ctx.beginPath();
        ctx.arc(px, py, p.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Corpo do planeta com sombreado 3D
        const planetBodyGrad = ctx.createRadialGradient(
          px - p.radius * 0.35,
          py - p.radius * 0.35,
          p.radius * 0.1,
          px,
          py,
          p.radius
        );
        planetBodyGrad.addColorStop(0, '#ffffff');
        planetBodyGrad.addColorStop(0.3, p.color);
        planetBodyGrad.addColorStop(1, '#050a14');
        ctx.fillStyle = planetBodyGrad;
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Anéis planetários (estilo Saturno Cibernético)
        if (p.hasRings && p.ringColor) {
          ctx.save();
          ctx.strokeStyle = p.ringColor;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(px, py, p.radius * 2.4, p.radius * 0.65, 0.45, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(px, py, p.radius * 2.8, p.radius * 0.8, 0.45, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Luas orbitando o planeta
        if (p.moons) {
          p.moons.forEach((m) => {
            m.angle += m.speed;
            const mx = px + Math.cos(m.angle) * m.dist;
            const my = py + Math.sin(m.angle) * (m.dist * 0.5);

            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.arc(mx, my, m.radius, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Tag holográfica do planeta de IA
        if (p.aiLabel) {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.aiLabel, px, py + p.radius + 12);
        }
      });

      // ==========================================
      // SATÉLITES ARTIFICIAIS & FEIXES DE DADOS
      // ==========================================
      satellites.forEach((sat) => {
        sat.angle += sat.speed;
        const sx = centerX + Math.cos(sat.angle) * sat.orbitRadiusX;
        const sy = centerY + Math.sin(sat.angle) * sat.orbitRadiusY;

        // Órbita sutil do satélite
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, sat.orbitRadiusX, sat.orbitRadiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Feixe de Dados de IA (Laser Data Link com o Núcleo)
        sat.pulseTimer += 0.02;
        const beamPulse = (Math.sin(sat.pulseTimer * 4) + 1) * 0.5;
        if (beamPulse > 0.4) {
          ctx.save();
          ctx.strokeStyle = `rgba(56, 189, 248, ${beamPulse * 0.22})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 5]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
          ctx.restore();
        }

        // Desenha o satélite com painéis solares
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sat.angle + Math.PI / 2);

        // Corpo central
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-2, -3, 4, 6);

        // Painéis solares (asas azuis)
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-8, -2, 5, 4);
        ctx.fillRect(3, -2, 5, 4);

        // Luz estroboscópica do satélite piscando
        const beacon = (Math.sin(time * 6 + sat.beaconTimer * 10) + 1) * 0.5;
        if (beacon > 0.7) {
          ctx.fillStyle = sat.color;
          ctx.beginPath();
          ctx.arc(0, -4, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Rótulo discreto do satélite
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = '7.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(sat.name, sx + 10, sy - 2);
      });

      // ==========================================
      // ESPAÇONAVES FUTURISTAS CRUZANDO O ESPAÇO
      // ==========================================
      spaceships.forEach((ship) => {
        ship.x += ship.vx;
        ship.y += ship.vy;

        // Grava histórico de rastro de propulsão iônica
        ship.trail.unshift({ x: ship.x, y: ship.y, alpha: 0.8 });
        if (ship.trail.length > 22) ship.trail.pop();

        // Desenha rastro de plasma de propulsão
        for (let t = 0; t < ship.trail.length; t++) {
          const pt = ship.trail[t];
          pt.alpha *= 0.88;
          ctx.fillStyle = ship.color;
          ctx.globalAlpha = pt.alpha * 0.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (1 - t / ship.trail.length) * 3 * ship.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Desenha a espaçonave (design aerodinâmico futurista)
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);
        ctx.scale(ship.scale, ship.scale);

        // Fuselagem
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();

        // Detalhes da cabine de comando (cyan glow)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(2, 0, 4, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Propulsor traseiro de plasma
        ctx.fillStyle = ship.color;
        ctx.beginPath();
        ctx.arc(-5, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Respawn da nave quando sai da tela
        if (ship.vx > 0 && ship.x > width + 100) {
          ship.x = -60;
          ship.y = Math.random() * (height * 0.7) + height * 0.15;
          ship.trail = [];
        } else if (ship.vx < 0 && ship.x < -100) {
          ship.x = width + 60;
          ship.y = Math.random() * (height * 0.7) + height * 0.15;
          ship.trail = [];
        }
        if (ship.vy < 0 && ship.y < -80) {
          ship.y = height + 60;
          ship.x = Math.random() * width;
          ship.trail = [];
        }
      });

      if (ambientActive) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [ambientActive]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: '100vw', height: '100vh' }}
      />
    </div>
  );
};
