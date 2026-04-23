precision highp float;

varying float v_color_t;
varying float v_point_size;

uniform vec4 u_color_start;
uniform vec4 u_color_end;

void main() {
    // Distance from center of point sprite in [0, 0.5] space
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    // Discard fragments clearly outside the circle
    if (dist > 0.5) {
        discard;
    }

    // Anti-alias: smooth falloff over ~1.5 screen pixels at the edge.
    // In point-coord space, 1 pixel = 1/v_point_size.
    float pixelWidth = 1.5 / max(v_point_size, 1.0);
    float alpha = 1.0 - smoothstep(0.5 - pixelWidth, 0.5, dist);

    // Interpolate color
    vec4 color = mix(u_color_start, u_color_end, clamp(v_color_t, 0.0, 1.0));
    gl_FragColor = vec4(color.rgb, color.a * alpha);
}
