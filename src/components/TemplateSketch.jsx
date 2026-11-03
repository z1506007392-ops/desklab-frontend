// Top-down sketches of the three presets. These are diagrams, not photos:
// a clear plan is safer than a picture whose licence we have not checked.
// The seat is at the bottom. The dashed bar is the strip under the back edge.

const SOURCES = [
  ['CCOHS', 'https://www.ccohs.ca/oshanswers/ergonomics/office/monitor_positioning.html'],
  ['加州大学戴维斯分校双屏', 'https://safetyservices.ucdavis.edu/units/occupational-health/ergonomics/office-computer/dual-monitor'],
  ['Mayo Clinic', 'https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/office-ergonomics/art-20046169'],
  ['英特尔游戏桌', 'https://www.intel.com/content/www/us/en/gaming/resources/gaming-desk-setup.html'],
  ['少数派理线', 'https://sspai.com/post/70006'],
  ['什么值得买桌下线槽', 'https://post.smzdm.com/p/am880nm4/'],
];

function Plan({ label, children }) {
  return (
    <figure className="template-sketch">
      <svg viewBox="0 0 160 96" role="img" aria-label={label}>
        <rect className="template-sketch-desk" x="28" y="14" width="104" height="68" rx="4" />
        <rect className="template-sketch-strip" x="40" y="18" width="80" height="5" rx="1" />
        {children}
      </svg>
    </figure>
  );
}

const SKETCHES = {
  'home-office': (
    <Plan label="极简单屏俯视示意图：27 英寸显示器在后沿正中，键盘在前沿正中，鼠标在键盘右侧，插排在桌面下靠后。">
      <rect className="template-sketch-screen" x="62" y="26" width="36" height="10" rx="1" />
      <rect className="template-sketch-input" x="64" y="64" width="32" height="8" rx="1" />
      <rect className="template-sketch-input" x="100" y="66" width="8" height="6" rx="2" />
    </Plan>
  ),
  'desktop-dual': (
    <Plan label="电竞双屏俯视示意图：两台 27 英寸显示器呈浅 V，接缝在正中，键盘对准接缝，鼠标在右，主机在左侧地上，插排在桌面下靠后。">
      <g transform="rotate(-14 52 32)">
        <rect className="template-sketch-screen" x="36" y="26" width="34" height="10" rx="1" />
      </g>
      <g transform="rotate(14 108 32)">
        <rect className="template-sketch-screen" x="90" y="26" width="34" height="10" rx="1" />
      </g>
      <rect className="template-sketch-input" x="64" y="64" width="32" height="8" rx="1" />
      <rect className="template-sketch-input" x="100" y="66" width="8" height="6" rx="2" />
      <rect className="template-sketch-tower" x="8" y="30" width="14" height="28" rx="2" />
    </Plan>
  ),
  gaming: (
    <Plan label="超宽俯视示意图：带鱼屏在后沿正中，键盘对准中线，鼠标在右，主机在左侧地上，路由器靠后，插排在桌面下靠后。">
      <rect className="template-sketch-screen" x="40" y="26" width="80" height="10" rx="1" />
      <rect className="template-sketch-input" x="64" y="64" width="32" height="8" rx="1" />
      <rect className="template-sketch-input" x="100" y="66" width="8" height="6" rx="2" />
      <rect className="template-sketch-tower" x="8" y="30" width="14" height="28" rx="2" />
      <rect className="template-sketch-input" x="138" y="18" width="16" height="8" rx="1" />
    </Plan>
  ),
};

export function PresetSources() {
  return (
    <p className="template-card-sources">
      示意图，不是实拍。屏幕仍用现有模型的高度。依据
      {SOURCES.map(([label, href], index) => (
        <span key={href}>
          {index > 0 ? '、' : ''}
          <a href={href} target="_blank" rel="noreferrer">{label}</a>
        </span>
      ))}
      。
    </p>
  );
}

export default function TemplateSketch({ templateId }) {
  return SKETCHES[templateId] ?? null;
}
