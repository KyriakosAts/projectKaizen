use image::{ImageBuffer, Rgba, RgbaImage};
use imageproc::drawing::{draw_filled_circle_mut, draw_filled_rect_mut, draw_line_segment_mut};
use imageproc::rect::Rect;
use std::path::Path;

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG:       Rgba<u8> = Rgba([10,  14,  26,  255]); // deep navy
const RING1:    Rgba<u8> = Rgba([30,  41,  70,  255]); // mid navy
const ACCENT:   Rgba<u8> = Rgba([99,  91,  255, 255]); // brand violet
const ACCENT2:  Rgba<u8> = Rgba([138, 99,  255, 255]); // lighter violet
const WHITE:    Rgba<u8> = Rgba([240, 240, 255, 255]); // near white
const GOLD:     Rgba<u8> = Rgba([255, 200, 60,  255]); // belt gold
const TRANSP:   Rgba<u8> = Rgba([0,   0,   0,   0  ]); // transparent

fn lerp_color(a: Rgba<u8>, b: Rgba<u8>, t: f32) -> Rgba<u8> {
    let t = t.clamp(0.0, 1.0);
    Rgba([
        (a[0] as f32 + (b[0] as f32 - a[0] as f32) * t) as u8,
        (a[1] as f32 + (b[1] as f32 - a[1] as f32) * t) as u8,
        (a[2] as f32 + (b[2] as f32 - a[2] as f32) * t) as u8,
        (a[3] as f32 + (b[3] as f32 - a[3] as f32) * t) as u8,
    ])
}

fn blend(dst: Rgba<u8>, src: Rgba<u8>) -> Rgba<u8> {
    let sa = src[3] as f32 / 255.0;
    let da = dst[3] as f32 / 255.0;
    let oa = sa + da * (1.0 - sa);
    if oa < 0.001 { return TRANSP; }
    Rgba([
        ((src[0] as f32 * sa + dst[0] as f32 * da * (1.0 - sa)) / oa) as u8,
        ((src[1] as f32 * sa + dst[1] as f32 * da * (1.0 - sa)) / oa) as u8,
        ((src[2] as f32 * sa + dst[2] as f32 * da * (1.0 - sa)) / oa) as u8,
        (oa * 255.0) as u8,
    ])
}

// Draw an anti-aliased circle ring (donut)
fn draw_ring(img: &mut RgbaImage, cx: f32, cy: f32, r_inner: f32, r_outer: f32, color: Rgba<u8>) {
    let (w, h) = img.dimensions();
    let x0 = ((cx - r_outer - 1.0) as i32).max(0) as u32;
    let x1 = ((cx + r_outer + 1.0) as i32).min(w as i32 - 1) as u32;
    let y0 = ((cy - r_outer - 1.0) as i32).max(0) as u32;
    let y1 = ((cy + r_outer + 1.0) as i32).min(h as i32 - 1) as u32;

    for py in y0..=y1 {
        for px in x0..=x1 {
            let dx = px as f32 - cx;
            let dy = py as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            // AA edges
            let alpha_outer = ((r_outer + 0.5 - dist) * 255.0).clamp(0.0, 255.0) as u8;
            let alpha_inner = ((dist - r_inner + 0.5) * 255.0).clamp(0.0, 255.0) as u8;
            let alpha = ((alpha_outer as u16 * alpha_inner as u16) / 255) as u8;

            if alpha > 0 {
                let mut c = color;
                c[3] = ((c[3] as u16 * alpha as u16) / 255) as u8;
                let existing = *img.get_pixel(px, py);
                img.put_pixel(px, py, blend(existing, c));
            }
        }
    }
}

// Draw a filled AA circle
fn draw_circle_aa(img: &mut RgbaImage, cx: f32, cy: f32, r: f32, color: Rgba<u8>) {
    draw_ring(img, cx, cy, 0.0, r, color);
}

// Draw a polygon (for the octagon outline)
fn draw_polygon_ring(img: &mut RgbaImage, cx: f32, cy: f32, r: f32, sides: u32, thickness: f32, color: Rgba<u8>) {
    let step = std::f32::consts::TAU / sides as f32;
    let offset = std::f32::consts::PI / sides as f32; // rotate so flat side is on bottom
    for i in 0..sides {
        let a0 = i as f32 * step + offset;
        let a1 = (i + 1) as f32 * step + offset;
        let x0 = cx + r * a0.cos();
        let y0 = cy + r * a0.sin();
        let x1 = cx + r * a1.cos();
        let y1 = cy + r * a1.sin();
        draw_thick_line(img, x0, y0, x1, y1, thickness, color);
    }
}

fn draw_thick_line(img: &mut RgbaImage, x0: f32, y0: f32, x1: f32, y1: f32, w: f32, color: Rgba<u8>) {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let len = (dx * dx + dy * dy).sqrt();
    if len < 0.001 { return; }
    let nx = -dy / len;
    let ny = dx / len;
    let hw = w / 2.0;

    let (iw, ih) = img.dimensions();
    let min_x = x0.min(x1) - hw - 1.0;
    let max_x = x0.max(x1) + hw + 1.0;
    let min_y = y0.min(y1) - hw - 1.0;
    let max_y = y0.max(y1) + hw + 1.0;

    let px0 = (min_x as i32).max(0) as u32;
    let px1 = (max_x as i32 + 1).min(iw as i32 - 1) as u32;
    let py0 = (min_y as i32).max(0) as u32;
    let py1 = (max_y as i32 + 1).min(ih as i32 - 1) as u32;

    for py in py0..=py1 {
        for px in px0..=px1 {
            let qx = px as f32 - x0;
            let qy = py as f32 - y0;
            let along = qx * (dx / len) + qy * (dy / len);
            let perp  = (qx * nx + qy * ny).abs();
            if along < -0.5 || along > len + 0.5 { continue; }
            let alpha = ((hw + 0.5 - perp) * 255.0).clamp(0.0, 255.0) as u8;
            if alpha > 0 {
                let mut c = color;
                c[3] = ((c[3] as u16 * alpha as u16) / 255) as u8;
                let existing = *img.get_pixel(px, py);
                img.put_pixel(px, py, blend(existing, c));
            }
        }
    }
}

// Radial gradient fill
fn fill_radial_gradient(img: &mut RgbaImage, cx: f32, cy: f32, r: f32, inner: Rgba<u8>, outer: Rgba<u8>) {
    let (w, h) = img.dimensions();
    let x0 = ((cx - r - 1.0) as i32).max(0) as u32;
    let x1 = ((cx + r + 1.0) as i32).min(w as i32 - 1) as u32;
    let y0 = ((cy - r - 1.0) as i32).max(0) as u32;
    let y1 = ((cy + r + 1.0) as i32).min(h as i32 - 1) as u32;

    for py in y0..=y1 {
        for px in x0..=x1 {
            let dx = px as f32 - cx;
            let dy = py as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let alpha_edge = ((r + 0.5 - dist) * 255.0).clamp(0.0, 255.0) as u8;
            if alpha_edge > 0 {
                let t = (dist / r).clamp(0.0, 1.0);
                let mut c = lerp_color(inner, outer, t);
                c[3] = ((c[3] as u16 * alpha_edge as u16) / 255) as u8;
                let existing = *img.get_pixel(px, py);
                img.put_pixel(px, py, blend(existing, c));
            }
        }
    }
}

// ─── Kanji-inspired "D" glyph drawn with geometric lines ─────────────────────
// Simplified stylised "D J" using bezier-approximated strokes
fn draw_dj_glyph(img: &mut RgbaImage, cx: f32, cy: f32, scale: f32, color: Rgba<u8>) {
    let s = scale;
    let lw = (s * 0.12).max(1.5);

    // ── D ──
    let dx = cx - s * 0.28;
    // vertical stem
    draw_thick_line(img, dx, cy - s * 0.38, dx, cy + s * 0.38, lw, color);
    // top horizontal
    draw_thick_line(img, dx, cy - s * 0.38, dx + s * 0.18, cy - s * 0.38, lw, color);
    // bottom horizontal
    draw_thick_line(img, dx, cy + s * 0.38, dx + s * 0.18, cy + s * 0.38, lw, color);
    // curved right side approximated with 3 line segments
    let pts_d = [
        (dx + s * 0.18, cy - s * 0.38),
        (dx + s * 0.44, cy - s * 0.20),
        (dx + s * 0.50, cy),
        (dx + s * 0.44, cy + s * 0.20),
        (dx + s * 0.18, cy + s * 0.38),
    ];
    for w in pts_d.windows(2) {
        draw_thick_line(img, w[0].0, w[0].1, w[1].0, w[1].1, lw, color);
    }

    // ── J ──
    let jx = cx + s * 0.14;
    // top horizontal bar
    draw_thick_line(img, jx - s * 0.06, cy - s * 0.38, jx + s * 0.26, cy - s * 0.38, lw, color);
    // vertical stem with downward tick
    draw_thick_line(img, jx + s * 0.10, cy - s * 0.38, jx + s * 0.10, cy + s * 0.22, lw, color);
    // curve at bottom
    let pts_j = [
        (jx + s * 0.10, cy + s * 0.22),
        (jx + s * 0.06, cy + s * 0.36),
        (jx - s * 0.08, cy + s * 0.40),
        (jx - s * 0.18, cy + s * 0.30),
    ];
    for w in pts_j.windows(2) {
        draw_thick_line(img, w[0].0, w[0].1, w[1].0, w[1].1, lw, color);
    }
}

// Belt stripe at bottom of circle
fn draw_belt_stripes(img: &mut RgbaImage, cx: f32, cy: f32, r: f32) {
    // three horizontal stripes at bottom of circle, clipped to circle
    let colors = [GOLD, WHITE, ACCENT];
    let stripe_h = r * 0.10;
    let y_start = cy + r * 0.55;

    let (w, h) = img.dimensions();

    for (i, &col) in colors.iter().enumerate() {
        let y_top = y_start + i as f32 * stripe_h;
        let y_bot = y_top + stripe_h * 0.8;

        let py0 = (y_top as i32).max(0) as u32;
        let py1 = (y_bot as i32 + 1).min(h as i32 - 1) as u32;

        for py in py0..=py1 {
            let row_frac_top = ((py as f32 - y_top + 0.5) * 255.0).clamp(0.0, 255.0) as u8;
            let row_frac_bot = ((y_bot - py as f32 + 0.5) * 255.0).clamp(0.0, 255.0) as u8;
            let row_aa = row_frac_top.min(row_frac_bot);

            // x extent clipped to circle
            let dy = py as f32 - cy;
            let chord = ((r * r - dy * dy).max(0.0)).sqrt();
            let px0 = ((cx - chord * 0.78) as i32).max(0) as u32;
            let px1 = ((cx + chord * 0.78) as i32).min(w as i32 - 1) as u32;

            for px in px0..=px1 {
                let edge_aa = {
                    let dx = px as f32 - cx;
                    let max_x = chord * 0.78;
                    ((max_x - dx.abs() + 0.5) * 255.0).clamp(0.0, 255.0) as u8
                };
                let alpha = ((row_aa as u16 * edge_aa as u16) / 255) as u8;
                if alpha > 0 {
                    let mut c = col;
                    c[3] = ((c[3] as u16 * alpha as u16) / 255) as u8;
                    let existing = *img.get_pixel(px, py);
                    img.put_pixel(px, py, blend(existing, c));
                }
            }
        }
    }
}

// ─── Main render function ─────────────────────────────────────────────────────
fn render(size: u32) -> RgbaImage {
    let mut img: RgbaImage = ImageBuffer::new(size, size);
    let s = size as f32;
    let cx = s / 2.0;
    let cy = s / 2.0;
    let r = s * 0.46;

    // 1. Transparent background (for PNG with alpha)
    for px in img.pixels_mut() { *px = TRANSP; }

    // 2. Outer glow
    let glow_color = Rgba([99, 91, 255, 18]);
    draw_circle_aa(&mut img, cx, cy, r + s * 0.04, glow_color);

    // 3. Main disc with radial gradient
    let inner_col = Rgba([22, 28, 54, 255]);
    let outer_col = Rgba([10, 13, 28, 255]);
    fill_radial_gradient(&mut img, cx, cy, r, inner_col, outer_col);

    // 4. Subtle inner ring (depth)
    draw_ring(&mut img, cx, cy, r * 0.88, r * 0.92, RING1);

    // 5. Accent gradient ring (the glow border)
    // Draw two overlapping rings to simulate gradient: violet → purple
    draw_ring(&mut img, cx, cy, r - s * 0.02, r, ACCENT2);
    draw_ring(&mut img, cx, cy, r - s * 0.01, r, ACCENT);

    // 6. Octagon outline (martial arts ring)
    draw_polygon_ring(&mut img, cx, cy, r * 0.80, 8, s * 0.012, Rgba([99, 91, 255, 60]));

    // 7. Belt stripes (decorative bottom)
    draw_belt_stripes(&mut img, cx, cy, r);

    // 8. "DJ" glyph
    draw_dj_glyph(&mut img, cx, cy * 0.93, s * 0.28, WHITE);

    // 9. Four corner dots (dojo corner marks)
    let dot_r = s * 0.018;
    let dot_d = r * 0.68;
    for &(ax, ay) in &[(1.0f32, -1.0f32), (-1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)] {
        let angle = std::f32::consts::FRAC_PI_4 * if ax > 0.0 { if ay < 0.0 { 7.0 } else { 1.0 } } else { if ay < 0.0 { 5.0 } else { 3.0 } };
        let px = cx + dot_d * angle.cos();
        let py = cy + dot_d * angle.sin();
        draw_circle_aa(&mut img, px, py, dot_r, ACCENT);
    }

    img
}

// ─── ICO writer ──────────────────────────────────────────────────────────────
fn save_ico(images: &[(u32, RgbaImage)], path: &Path) -> std::io::Result<()> {
    let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);
    for (_, img) in images {
        let (w, h) = img.dimensions();
        let raw = img.as_raw();
        let ico_img = ico::IconImage::from_rgba_data(w, h, raw.clone());
        icon_dir.add_entry(ico::IconDirEntry::encode(&ico_img).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
        })?);
    }
    let file = std::fs::File::create(path)?;
    icon_dir.write(file).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
}

fn main() {
    // Output paths relative to project root (run from project root)
    let out_png = Path::new("src-tauri/icons/icon.png");
    let out_ico = Path::new("src-tauri/icons/icon.ico");
    let out_32  = Path::new("src-tauri/icons/32x32.png");
    let out_128 = Path::new("src-tauri/icons/128x128.png");
    let out_logo = Path::new("logo.png");

    std::fs::create_dir_all("src-tauri/icons").unwrap();

    println!("Rendering icons...");

    let img256 = render(256);
    let img128 = image::imageops::resize(&img256, 128, 128, image::imageops::FilterType::Lanczos3);
    let img64  = image::imageops::resize(&img256, 64,  64,  image::imageops::FilterType::Lanczos3);
    let img48  = image::imageops::resize(&img256, 48,  48,  image::imageops::FilterType::Lanczos3);
    let img32  = image::imageops::resize(&img256, 32,  32,  image::imageops::FilterType::Lanczos3);
    let img16  = image::imageops::resize(&img256, 16,  16,  image::imageops::FilterType::Lanczos3);

    img256.save(out_png).unwrap();
    img256.save(out_logo).unwrap();
    img128.save(out_128).unwrap();
    img32.save(out_32).unwrap();

    save_ico(
        &[(256, img256), (128, img128), (64, img64), (48, img48), (32, img32), (16, img16)],
        out_ico,
    ).unwrap();

    println!("Done!");
    println!("  src-tauri/icons/icon.png  (256x256)");
    println!("  src-tauri/icons/icon.ico  (multi-res: 16/32/48/64/128/256)");
    println!("  src-tauri/icons/128x128.png");
    println!("  src-tauri/icons/32x32.png");
    println!("  logo.png");
}
