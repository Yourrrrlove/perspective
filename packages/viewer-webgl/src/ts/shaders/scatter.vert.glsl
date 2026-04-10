attribute vec2 a_position;
attribute float a_color_value;
attribute float a_size_value;

uniform mat4 u_projection;
uniform float u_point_size;
uniform vec2 u_color_range;
uniform vec2 u_size_range;
uniform vec2 u_point_size_range;

varying float v_color_t;
varying float v_point_size;

void main() {
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);

    // Per-vertex point size from size attribute
    float sizeRange = u_size_range.y - u_size_range.x;
    if (sizeRange > 0.0) {
        float size_t = clamp((a_size_value - u_size_range.x) / sizeRange, 0.0, 1.0);
        gl_PointSize = mix(u_point_size_range.x, u_point_size_range.y, size_t);
    } else {
        gl_PointSize = u_point_size;
    }

    // Pass point size to fragment shader for AA calculation
    v_point_size = gl_PointSize;

    // Normalize color value to 0..1 range
    float range = u_color_range.y - u_color_range.x;
    v_color_t = range > 0.0
        ? (a_color_value - u_color_range.x) / range
        : 0.5;
}
