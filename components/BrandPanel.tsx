import { Save, Check, Trash2 } from "lucide-react";
import type { BrandKit } from "../lib/brand";
export default function BrandPanel({
  kit,
  onChange,
  onSave,
  onApply,
  onCapture,
}: {
  kit: BrandKit;
  onChange: (b: BrandKit) => void;
  onSave: () => void;
  onApply: () => void;
  onCapture: () => void;
}) {
  return (
    <div className="brandpanel">
      <h4>品牌配置</h4>
      <label>
        品牌名
        <input
          maxLength={80}
          value={kit.name}
          onChange={(e) => onChange({ ...kit, name: e.target.value })}
        />
      </label>
      <label>
        强调色
        <div className="brandcolor">
          <input
            type="color"
            value={kit.accent}
            onChange={(e) => onChange({ ...kit, accent: e.target.value })}
          />
          <span>{kit.accent.toUpperCase()}</span>
        </div>
      </label>
      <div className="brandlogostatus">
        {kit.logo
          ? "已保存 Logo，可跨作品复用"
          : "尚未保存 Logo，上传后可从当前画布提取"}
        {kit.logo && (
          <button
            className="icon"
            title="移除配置中的Logo"
            onClick={() => onChange({ ...kit, logo: undefined })}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="brandbuttons">
        <button onClick={onCapture}>从当前设计提取</button>
        <button onClick={onSave}>
          <Save size={12} />
          保存配置
        </button>
        <button className="primary" onClick={onApply}>
          <Check size={12} />
          应用到本作品
        </button>
      </div>
      <small>品牌配置仅保存在当前浏览器，Logo 不会发送给文字模型。</small>
    </div>
  );
}
