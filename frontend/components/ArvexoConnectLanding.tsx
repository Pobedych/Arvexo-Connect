"use client";

import { geoEquirectangular, geoPath } from "d3-geo";
import { motion } from "framer-motion";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CircuitBoard,
  DatabaseZap,
  Globe2,
  Headphones,
  Laptop,
  Layers3,
  Menu,
  Network,
  Plane,
  Router,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Split,
  X,
  Zap
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesAtlas from "world-atlas/countries-110m.json";

const navItems = [
  { href: "#features", label: "Возможности" },
  { href: "#modes", label: "Режимы" },
  { href: "#servers", label: "Серверы" },
  { href: "#pricing", label: "Тарифы" },
  { href: "#how-it-works", label: "Инструкция" },
  { href: "/cabinet/login", label: "Кабинет" },
  { href: "#support", label: "Поддержка" }
];

const trustItems = [
  {
    icon: Split,
    title: "Smart Routing",
    text: "Локальные сервисы открываются напрямую, зарубежные — через VPN."
  },
  {
    icon: CircuitBoard,
    title: "Dual Protocol",
    text: "Reality и Hysteria в одной подписке для разных сетевых сценариев."
  },
  {
    icon: Server,
    title: "Multi-Node",
    text: "Несколько серверов для стабильности, резерва и переключения маршрутов."
  },
  {
    icon: Headphones,
    title: "Human Support",
    text: "Помощь с подключением без UUID, SNI и технической боли."
  }
];

const pains = [
  { icon: Banknote, title: "Банки ругаются на вход" },
  { icon: Router, title: "Маркетплейсы открываются нестабильно" },
  { icon: Globe2, title: "Локальные сервисы видят чужой регион" },
  { icon: Zap, title: "Приходится вручную включать и выключать VPN" }
];

const modes = [
  {
    title: "Smart Russia",
    label: "Recommended",
    text: "Для повседневного использования в России. .ru, банки, Ozon, Яндекс, VK и другие локальные сервисы открываются напрямую. Остальное идёт через VPN.",
    points: ["Direct local", "Foreign tunnel", "Daily mode"],
    featured: true
  },
  {
    title: "Privacy",
    label: "Maximum tunnel",
    text: "Почти весь трафик идёт через защищённый туннель. Подходит, когда важнее приватность и единый внешний IP.",
    points: ["Single exit IP", "Tunnel first", "Privacy focus"]
  },
  {
    title: "Global",
    label: "Travel ready",
    text: "Для поездок, Китая, Ирана и нестабильных сетей. Локальные сервисы выбранной страны можно оставить напрямую, остальное пустить через VPN.",
    points: ["Country rules", "Hard networks", "Flexible route"]
  }
];

const steps = [
  {
    title: "Получаете доступ",
    text: "После оплаты или выдачи ключа вы получаете одну постоянную ссылку подписки."
  },
  {
    title: "Импортируете в приложение",
    text: "Подходит для Hiddify, V2RayTun, NekoBox и других клиентов."
  },
  {
    title: "Меняете режим",
    text: "В боте или кабинете выбираете Smart, Privacy или Global."
  },
  {
    title: "Обновляете подписку",
    text: "Ссылка остаётся той же, но конфиг обновляется под выбранный режим."
  }
];

const infra = ["Germany Node", "Netherlands Node", "Reality 443/tcp", "Hysteria 443/udp", "Backup routing", "Split routing"];

const features = [
  {
    icon: CircuitBoard,
    title: "Reality + Hysteria",
    text: "Два протокола в одной подписке: TCP-стабильность и UDP-скорость."
  },
  {
    icon: Network,
    title: "Smart DNS & Routing",
    text: "Локальные и зарубежные сервисы обрабатываются по разным правилам."
  },
  {
    icon: Headphones,
    title: "Telegram Support",
    text: "Быстрая помощь, инструкции и выдача доступа через бота."
  },
  {
    icon: Layers3,
    title: "One Subscription",
    text: "Одна ссылка для всех серверов, режимов и обновлений."
  },
  {
    icon: Sparkles,
    title: "No Technical Setup",
    text: "Пользователь не видит UUID, SNI, shortId и другие сложные настройки."
  },
  {
    icon: Smartphone,
    title: "Multi-device Access",
    text: "Подключение на телефоне, ПК, планшете и роутере."
  }
];

const pricing = [
  {
    title: "Start",
    price: "199 ₽",
    text: "Для одного устройства и базового подключения.",
    features: ["1 устройство", "Основной профиль", "Инструкция подключения"]
  },
  {
    title: "Connect",
    price: "299 ₽",
    text: "Smart Routing, Reality + Hysteria, несколько серверов.",
    features: ["Arvexo Route Control", "Reality + Hysteria", "Multi-node infrastructure"],
    featured: true
  },
  {
    title: "Family",
    price: "599 ₽",
    text: "Несколько устройств, поддержка и резервные профили.",
    features: ["Несколько устройств", "Поддержка семьи", "Резервные профили"]
  }
];

const useCases = [
  {
    icon: Laptop,
    title: "Для повседневного интернета",
    text: "Зарубежные сервисы через VPN, локальные сайты напрямую."
  },
  {
    icon: Plane,
    title: "Для поездок",
    text: "Меняйте режим под страну и сеть."
  },
  {
    icon: ShieldCheck,
    title: "Для работы",
    text: "Стабильный доступ к нужным сервисам без постоянного переключения."
  },
  {
    icon: Headphones,
    title: "Для семьи",
    text: "Понятная инструкция и поддержка без технических терминов."
  }
];

const faq = [
  {
    question: "Это обычный VPN?",
    answer: "Нет. Arvexo Connect — это VPN-доступ с умными режимами маршрутизации."
  },
  {
    question: "Российские сайты будут работать?",
    answer:
      "В режиме Smart Russia локальные сервисы открываются напрямую, чтобы не ломать банки, маркетплейсы и привычные сайты."
  },
  {
    question: "Можно ли пустить всё через VPN?",
    answer: "Да. Для этого есть Privacy Mode."
  },
  {
    question: "Что делать, если один сервер не работает?",
    answer: "В подписке есть резервные узлы и протоколы."
  },
  {
    question: "Нужно ли разбираться в настройках?",
    answer: "Нет. Вы выбираете режим, а конфиг обновляется автоматически."
  }
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

export function ArvexoConnectLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_0%,rgba(239,35,60,0.18),transparent_28rem),radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.06),transparent_20rem),#050505]" />
      <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <Hero />
        <TrustBar />
        <ProblemSection />
        <RouteControl />
        <HowItWorks />
        <Infrastructure />
        <Features />
        <Pricing />
        <UseCases />
        <FAQ />
        <FinalCTA />
      </main>
      <ConnectFooter />
    </div>
  );
}

function Header({
  menuOpen,
  setMenuOpen
}: {
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] w-[min(calc(100%-32px),1180px)] items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-3" aria-label="Arvexo Connect">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#ef233c]/35 bg-[#ef233c]/10 text-[#ff2b3a] shadow-[0_0_34px_rgba(239,35,60,0.22)]">
            <Shield className="h-5 w-5" />
          </span>
          <span className="text-[1.05rem] font-semibold tracking-[0] text-white">Arvexo Connect</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Основная навигация">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-white/62 transition hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href="/cabinet/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition hover:text-white">
            Войти
          </a>
          <a
            href="#pricing"
            className="rounded-lg bg-[#ef233c] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(239,35,60,0.32)] transition hover:-translate-y-0.5 hover:bg-[#ff2b3a]"
          >
            Получить доступ
          </a>
        </div>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-white lg:hidden"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="mx-auto grid w-[min(calc(100%-32px),1180px)] gap-2 pb-4 lg:hidden">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white/76"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/cabinet/login"
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white"
            onClick={() => setMenuOpen(false)}
          >
            Войти в кабинет
          </a>
          <a
            href="#pricing"
            className="rounded-lg bg-[#ef233c] px-4 py-3 text-center text-sm font-semibold text-white"
            onClick={() => setMenuOpen(false)}
          >
            Получить доступ
          </a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
      <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#ef233c]/10 blur-[110px]" />

      <div className="relative mx-auto grid w-[min(calc(100%-32px),1280px)] items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.15fr] lg:py-20">
        <div>
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">
            SMART VPN ACCESS
          </p>
          <h1 className="max-w-3xl text-balance text-[clamp(2.7rem,6vw,5.9rem)] font-semibold leading-[0.98] tracking-[0] text-white">
            VPN, который адаптируется под ваш интернет
          </h1>
          <p className="mt-7 max-w-2xl text-[1.05rem] leading-8 text-[#a3a3a3] md:text-lg">
            Arvexo Connect направляет зарубежные сервисы через защищённый туннель, а локальные сайты, банки и
            маркетплейсы открывает напрямую — быстро, стабильно и без лишних настроек.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ef233c] px-6 text-sm font-bold text-white shadow-[0_0_42px_rgba(239,35,60,0.34)] transition hover:-translate-y-0.5 hover:bg-[#ff2b3a]"
            >
              Получить доступ <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-[#ef233c]/45 hover:bg-[#ef233c]/10"
            >
              Посмотреть, как работает
            </a>
          </div>
          <p className="mt-6 text-sm font-medium text-white/48">
            Reality + Hysteria · Smart Routing · Multi-node infrastructure
          </p>
        </div>

        <div className="relative min-h-[430px] lg:min-h-[560px]">
          <WorldMap />
        </div>
      </div>
    </section>
  );
}

function WorldMap() {
  const [location, setLocation] = useState<IpLocation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      try {
        const data = await fetchIpLocation();

        if (cancelled) {
          return;
        }

        setLocation(data);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setLocation({
            city: "Не удалось определить",
            country: "проверьте доступ к IP lookup",
            ip: "недоступен",
            latitude: 55.7558,
            longitude: 37.6173,
            region: "Fallback"
          });
        }
      }
    }

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status === "loading"
      ? "Определяем местоположение по IP"
      : status === "error"
        ? "IP lookup сейчас недоступен"
        : `${location?.city}${location?.region ? `, ${location.region}` : ""}`;

  return (
    <div
      data-testid="ip-globe-panel"
      className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#070707] shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_35%,rgba(239,35,60,0.24),transparent_22rem),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
      <GlobeCanvas location={location} />
      <div
        data-testid="ip-location-card"
        className="absolute left-5 top-5 max-w-[min(calc(100%-40px),310px)] rounded-2xl border border-white/[0.09] bg-black/45 p-3.5 backdrop-blur-xl"
      >
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff2b3a]">IP location</p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug text-white">{label}</h2>
        <div className="mt-2 grid gap-1 text-xs leading-5 text-white/62">
          <span>IP: {status === "loading" ? "запрашиваем..." : location?.ip}</span>
          <span>Страна: {status === "loading" ? "..." : location?.country}</span>
          <span>
            Координаты:{" "}
            {status === "loading" ? "..." : `${location?.latitude.toFixed(2)}, ${location?.longitude.toFixed(2)}`}
          </span>
        </div>
      </div>
      <div
        data-testid="ip-globe-note"
        className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 text-xs leading-5 text-white/54 backdrop-blur-xl"
      >
        Точка показывает примерное местоположение по публичному IP. Точность зависит от провайдера и сети.
      </div>
    </div>
  );
}

function GlobeCanvas({ location }: { location: IpLocation | null }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const container = mount;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const worldTexture = createWorldTexture();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 96, 96),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#130207",
        emissiveIntensity: 0.18,
        map: worldTexture,
        metalness: 0.05,
        roughness: 0.64
      })
    );
    globeGroup.add(sphere);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 96, 96),
      new THREE.MeshBasicMaterial({
        color: "#ef233c",
        opacity: 0.1,
        side: THREE.BackSide,
        transparent: true
      })
    );
    globeGroup.add(atmosphere);

    const markerPosition = latLonToVector3(location?.latitude ?? 55.7558, location?.longitude ?? 37.6173, 1.37);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#ff2b3a" })
    );
    marker.position.copy(markerPosition);
    globeGroup.add(marker);

    const markerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#ef233c", opacity: 0.2, transparent: true })
    );
    markerGlow.position.copy(markerPosition.clone().multiplyScalar(1.005));
    globeGroup.add(markerGlow);

    const targetDirection = new THREE.Vector3(0.18, 0.08, 1).normalize();
    globeGroup.quaternion.copy(
      new THREE.Quaternion().setFromUnitVectors(markerPosition.clone().normalize(), targetDirection)
    );
    const dragState = {
      active: false,
      pointerId: 0,
      startX: 0,
      startY: 0,
      startQuaternion: globeGroup.quaternion.clone()
    };

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const key = new THREE.DirectionalLight(0xffeff1, 2.4);
    key.position.set(2.5, 2, 4);
    const rim = new THREE.DirectionalLight(0xef233c, 1.25);
    rim.position.set(-3, -1, -2);
    scene.add(ambient, key, rim);

    let frame = 0;

    function handlePointerDown(event: PointerEvent) {
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.startQuaternion.copy(globeGroup.quaternion);
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const horizontal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.006);
      const vertical = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.004);

      globeGroup.quaternion.copy(horizontal.multiply(vertical).multiply(dragState.startQuaternion));
    }

    function handlePointerUp(event: PointerEvent) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) {
        return;
      }

      dragState.active = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grab";
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const wheelRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * 0.0025);
      globeGroup.quaternion.premultiply(wheelRotation);
    }

    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const isDesktopPanel = window.matchMedia("(min-width: 768px)").matches;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      globeGroup.position.set(isDesktopPanel ? 0.7 : 0, isDesktopPanel ? -0.03 : -0.08, 0);
      globeGroup.scale.setScalar(isDesktopPanel ? 0.68 : 0.92);
    }

    function animate() {
      frame = requestAnimationFrame(animate);
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.22;
      markerGlow.scale.setScalar(pulse);
      renderer.render(scene, camera);
    }

    resize();
    animate();
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", resize);
      container.removeChild(renderer.domElement);
      worldTexture.dispose();
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      markerGlow.geometry.dispose();
      (markerGlow.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [location?.latitude, location?.longitude]);

  return (
    <div className="absolute inset-0" role="img" aria-label="3D Earth map with IP location">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_67%,rgba(239,35,60,0.16),transparent_15rem),radial-gradient(circle_at_50%_70%,rgba(255,255,255,0.06),transparent_17rem)] md:bg-[radial-gradient(circle_at_78%_50%,rgba(239,35,60,0.16),transparent_17rem),radial-gradient(circle_at_78%_52%,rgba(255,255,255,0.06),transparent_19rem)]" />
      <div
        ref={mountRef}
        data-testid="globe-canvas-zone"
        className="absolute bottom-[96px] left-3 right-3 top-[178px] md:inset-0"
      />
    </div>
  );
}

type IpLocation = {
  city: string;
  country: string;
  ip: string;
  latitude: number;
  longitude: number;
  region: string;
};

type IpWhoIsResponse = {
  success: boolean;
  message?: string;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
};

function createWorldTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;

  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const topology = countriesAtlas as unknown as WorldAtlasTopology;
  const collection = feature(topology, topology.objects.countries) as GeoFeatureCollection;
  const projection = geoEquirectangular()
    .translate([canvas.width / 2, canvas.height / 2])
    .scale(canvas.width / (2 * Math.PI));
  const path = geoPath(projection, context);

  context.fillStyle = "#07131d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.lineWidth = 1;

  for (let meridian = -180; meridian <= 180; meridian += 30) {
    context.beginPath();
    context.moveTo(projection([meridian, -80])?.[0] ?? 0, projection([meridian, -80])?.[1] ?? 0);
    for (let lat = -75; lat <= 80; lat += 5) {
      const point = projection([meridian, lat]);
      if (point) {
        context.lineTo(point[0], point[1]);
      }
    }
    context.stroke();
  }

  for (let parallel = -60; parallel <= 60; parallel += 30) {
    context.beginPath();
    const start = projection([-180, parallel]);
    if (start) {
      context.moveTo(start[0], start[1]);
    }
    for (let lon = -175; lon <= 180; lon += 5) {
      const point = projection([lon, parallel]);
      if (point) {
        context.lineTo(point[0], point[1]);
      }
    }
    context.stroke();
  }

  for (const country of collection.features) {
    context.beginPath();
    path(country);
    context.fillStyle = "rgba(245,245,245,0.64)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.42)";
    context.lineWidth = 0.7;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

function latLonToVector3(latitude: number, longitude: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

type CountryAtlasObjects = {
  countries: GeometryCollection<GeoJsonProperties>;
};

type WorldAtlasTopology = Topology<CountryAtlasObjects>;

type GeoCountryFeature = Feature<Geometry, GeoJsonProperties> & {
  id?: string | number;
};

type GeoFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties> & {
  features: GeoCountryFeature[];
};

type GeoJsResponse = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: string;
  longitude?: string;
};

async function fetchIpLocation(): Promise<IpLocation> {
  try {
    const response = await fetch("https://get.geojs.io/v1/ip/geo.json", { cache: "no-store" });
    const data = (await response.json()) as GeoJsResponse;
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!response.ok || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("GeoJS lookup failed");
    }

    return {
      city: data.city || "Unknown city",
      country: data.country || data.country_code || "Unknown country",
      ip: data.ip || "hidden",
      latitude,
      longitude,
      region: data.region || ""
    };
  } catch {
    const response = await fetch(
      "https://ipwho.is/?fields=success,message,ip,city,region,country,country_code,latitude,longitude",
      { cache: "no-store" }
    );
    const data = (await response.json()) as IpWhoIsResponse;

    if (!response.ok || !data.success || typeof data.latitude !== "number" || typeof data.longitude !== "number") {
      throw new Error(data.message || "IP lookup failed");
    }

    return {
      city: data.city || "Unknown city",
      country: data.country || data.country_code || "Unknown country",
      ip: data.ip || "hidden",
      latitude: data.latitude,
      longitude: data.longitude,
      region: data.region || ""
    };
  }
}


function TrustBar() {
  return (
    <Section id="features" className="pt-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {trustItems.map((item) => (
          <InfoCard key={item.title} {...item} />
        ))}
      </motion.div>
    </Section>
  );
}

function ProblemSection() {
  return (
    <Section>
      <SectionHeader
        kicker="Почему это важно"
        title="Обычный VPN часто ломает привычные сайты"
        text="Arvexo Connect решает это через умные режимы маршрутизации."
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {pains.map((pain) => (
          <InfoCard key={pain.title} {...pain} text="" compact />
        ))}
      </motion.div>
    </Section>
  );
}

function RouteControl() {
  return (
    <Section id="modes">
      <SectionHeader
        kicker="Arvexo Route Control"
        title="Вы сами выбираете, как должен работать интернет"
        text="Один доступ — разные режимы подключения. Меняйте логику маршрутизации без новой ссылки и без переустановки профиля."
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-12 grid gap-5 lg:grid-cols-3"
      >
        {modes.map((mode) => (
          <motion.article
            variants={fadeUp}
            key={mode.title}
            className={`group relative overflow-hidden rounded-2xl border p-7 transition hover:-translate-y-1 ${
              mode.featured
                ? "border-[#ef233c]/45 bg-[#141414] shadow-[0_0_60px_rgba(239,35,60,0.12)]"
                : "border-white/[0.08] bg-[#101010]"
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ef233c]/70 to-transparent opacity-0 transition group-hover:opacity-100" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff2b3a]">{mode.label}</p>
            <h3 className="mt-4 text-2xl font-semibold text-white">{mode.title}</h3>
            <p className="mt-4 min-h-[128px] text-[0.98rem] leading-7 text-[#a3a3a3]">{mode.text}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {mode.points.map((point) => (
                <span key={point} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70">
                  {point}
                </span>
              ))}
            </div>
            <a
              href="#pricing"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.1] px-4 text-sm font-bold text-white transition hover:border-[#ef233c]/45 hover:bg-[#ef233c]/10"
            >
              Выбрать режим <ArrowRight className="h-4 w-4" />
            </a>
          </motion.article>
        ))}
      </motion.div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeader kicker="Одна ссылка" title="Одна ссылка. Разные режимы." />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-12 grid gap-4 lg:grid-cols-4"
      >
        {steps.map((step, index) => (
          <motion.article
            variants={fadeUp}
            key={step.title}
            className="relative rounded-2xl border border-white/[0.08] bg-[#101010] p-6 transition hover:-translate-y-1 hover:border-[#ef233c]/35"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ef233c]/12 text-sm font-bold text-[#ff2b3a]">
              {index + 1}
            </span>
            <h3 className="mt-6 text-xl font-semibold text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[#a3a3a3]">{step.text}</p>
          </motion.article>
        ))}
      </motion.div>
    </Section>
  );
}

function Infrastructure() {
  return (
    <Section id="servers">
      <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionHeader
            align="left"
            kicker="Infrastructure"
            title="Стабильность не на одном сервере"
            text="Arvexo Connect использует несколько узлов и резервные протоколы, чтобы подключение оставалось рабочим даже при проблемах с одним маршрутом."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {infra.map((item) => (
              <span
                key={item}
                className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white/76"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="rounded-[28px] border border-white/[0.08] bg-[#101010] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
        >
          <div className="grid gap-3">
            <FlowNode icon={Laptop} title="User" text="Phone · Desktop · Router" />
            <FlowLine />
            <FlowNode icon={DatabaseZap} title="Smart Router" text="Mode rules · Subscription config" accent />
            <FlowLine />
            <div className="grid gap-3 md:grid-cols-3">
              <FlowNode icon={Shield} title="Germany" text="Reality 443/tcp" small />
              <FlowNode icon={Zap} title="Netherlands" text="Hysteria 443/udp" small />
              <FlowNode icon={Globe2} title="Direct Local" text="Banks · .ru · services" small />
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section>
      <SectionHeader kicker="Capabilities" title="Технологии скрыты, сценарии понятны" />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {features.map((feature) => (
          <InfoCard key={feature.title} {...feature} />
        ))}
      </motion.div>
    </Section>
  );
}

function Pricing() {
  return (
    <Section id="pricing">
      <SectionHeader
        kicker="Pricing"
        title="Простой доступ без лишней сложности"
        text="Мы делаем стабильный приватный доступ, умную маршрутизацию и понятное подключение."
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-12 grid gap-5 lg:grid-cols-3"
      >
        {pricing.map((plan) => (
          <motion.article
            variants={fadeUp}
            key={plan.title}
            className={`rounded-2xl border p-7 ${
              plan.featured
                ? "border-[#ef233c]/50 bg-[#141414] shadow-[0_0_70px_rgba(239,35,60,0.14)]"
                : "border-white/[0.08] bg-[#101010]"
            }`}
          >
            {plan.featured && (
              <span className="mb-5 inline-flex rounded-full bg-[#ef233c]/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#ff2b3a]">
                Popular
              </span>
            )}
            <h3 className="text-2xl font-semibold text-white">{plan.title}</h3>
            <p className="mt-4 text-[#a3a3a3]">{plan.text}</p>
            <div className="mt-7 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-[0] text-white">{plan.price}</span>
              <span className="pb-2 text-sm font-semibold text-white/46">/ месяц</span>
            </div>
            <div className="mt-7 grid gap-3">
              {plan.features.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-white/72">
                  <Check className="h-4 w-4 text-[#ff2b3a]" />
                  {item}
                </div>
              ))}
            </div>
            <a
              href="https://t.me/arvexo_support"
              className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-lg text-sm font-bold transition ${
                plan.featured
                  ? "bg-[#ef233c] text-white hover:bg-[#ff2b3a]"
                  : "border border-white/[0.1] bg-white/[0.04] text-white hover:border-[#ef233c]/45 hover:bg-[#ef233c]/10"
              }`}
            >
              Получить доступ
            </a>
          </motion.article>
        ))}
      </motion.div>
    </Section>
  );
}

function UseCases() {
  return (
    <Section>
      <SectionHeader kicker="Use cases" title="Для кого это" />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {useCases.map((item) => (
          <InfoCard key={item.title} {...item} />
        ))}
      </motion.div>
    </Section>
  );
}

function FAQ() {
  return (
    <Section id="support">
      <SectionHeader kicker="FAQ" title="Частые вопросы" />
      <div className="mx-auto mt-10 grid max-w-3xl gap-3">
        {faq.map((item) => (
          <details key={item.question} className="group rounded-2xl border border-white/[0.08] bg-[#101010]">
            <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-5 p-5 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="h-5 w-5 text-white/45 transition group-open:rotate-180 group-open:text-[#ff2b3a]" />
            </summary>
            <p className="px-5 pb-5 text-sm leading-7 text-[#a3a3a3]">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function FinalCTA() {
  return (
    <section className="px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-[1180px] overflow-hidden rounded-[28px] border border-[#ef233c]/25 bg-[#101010] p-8 text-center shadow-[0_0_90px_rgba(239,35,60,0.12)] md:p-14"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">Arvexo Connect</p>
        <h2 className="mx-auto mt-5 max-w-3xl text-balance text-[clamp(2rem,4vw,4rem)] font-semibold leading-tight tracking-[0] text-white">
          Подключение, которое работает под ваш сценарий
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#a3a3a3]">
          Smart Russia для повседневного интернета. Privacy для максимального туннеля. Global для поездок и сложных
          сетей.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="#pricing" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#ef233c] px-6 text-sm font-bold text-white">
            Получить Arvexo Connect
          </a>
          <a
            href="https://t.me/arvexo_support"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/[0.1] px-6 text-sm font-bold text-white"
          >
            Написать в поддержку
          </a>
        </div>
      </motion.div>
    </section>
  );
}

function ConnectFooter() {
  const columns = [
    ["Product", "Возможности", "Режимы", "Тарифы", "Инструкция", "Личный кабинет"],
    ["Company", "Arvexo", "Контакты", "Статус серверов"],
    ["Support", "Telegram", "FAQ", "Документация"],
    ["Legal", "Политика конфиденциальности", "Условия использования"]
  ];

  return (
    <footer className="border-t border-white/[0.08] bg-[#070707] py-12">
      <div className="mx-auto grid w-[min(calc(100%-32px),1180px)] gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#ef233c]/35 bg-[#ef233c]/10 text-[#ff2b3a]">
              <Shield className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold text-white">Arvexo Connect</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#a3a3a3]">
            VPN-доступ с режимами Smart Russia, Privacy и Global. Одна подписка, несколько узлов и понятное подключение.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map(([title, ...links]) => (
            <div key={title}>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <div className="mt-4 grid gap-3">
                {links.map((link) => (
                  <a key={link} href={footerHref(link)} className="text-sm text-white/50 transition hover:text-white">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

function footerHref(label: string) {
  const hrefs: Record<string, string> = {
    Возможности: "#features",
    Режимы: "#modes",
    Тарифы: "#pricing",
    Инструкция: "#how-it-works",
    "Личный кабинет": "/cabinet/login",
    Telegram: "https://t.me/arvexo_support",
    FAQ: "#support"
  };

  return hrefs[label] || "#top";
}

function InfoCard({
  icon: Icon,
  title,
  text,
  compact = false
}: {
  icon: typeof Shield;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <motion.article
      variants={fadeUp}
      className="group rounded-2xl border border-white/[0.08] bg-[#101010] p-6 transition hover:-translate-y-1 hover:border-[#ef233c]/35 hover:shadow-[0_0_48px_rgba(239,35,60,0.09)]"
    >
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#ef233c]/12 text-[#ff2b3a] transition group-hover:bg-[#ef233c]/18">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className={`text-white ${compact ? "mt-6 text-lg" : "mt-6 text-xl"} font-semibold`}>{title}</h3>
      {text && <p className="mt-3 text-sm leading-7 text-[#a3a3a3]">{text}</p>}
    </motion.article>
  );
}

function Section({
  children,
  className = "",
  id
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto w-[min(calc(100%-32px),1180px)] py-20 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({
  kicker,
  title,
  text,
  align = "center"
}: {
  kicker: string;
  title: string;
  text?: string;
  align?: "left" | "center";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-left"}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff2b3a]">{kicker}</p>
      <h2 className="mt-4 text-balance text-[clamp(2rem,4vw,4.25rem)] font-semibold leading-tight tracking-[0] text-white">
        {title}
      </h2>
      {text && <p className="mt-5 text-base leading-8 text-[#a3a3a3]">{text}</p>}
    </motion.div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  text,
  accent = false,
  small = false
}: {
  icon: typeof Shield;
  title: string;
  text: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 text-center ${
        accent ? "border-[#ef233c]/40 bg-[#ef233c]/10" : "border-white/[0.08] bg-white/[0.035]"
      } ${small ? "min-h-[150px]" : ""}`}
    >
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-black/30 text-[#ff2b3a]">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">{text}</p>
    </div>
  );
}

function FlowLine() {
  return <div className="mx-auto h-8 w-px bg-gradient-to-b from-transparent via-[#ef233c]/55 to-transparent" />;
}
