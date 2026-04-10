// Per-instance attributes (advance once per segment via divisor=1)
attribute vec2 a_start;
attribute vec2 a_end;

// Per-vertex attribute (advance every vertex, divisor=0)
// 0 = start+left, 1 = start+right, 2 = end+left, 3 = end+right
attribute float a_corner;

uniform mat4 u_projection;
uniform vec2 u_resolution;
uniform float u_line_width;

varying float v_edge_dist;

void main() {
    // Project both segment endpoints to clip space
    vec4 clipStart = u_projection * vec4(a_start, 0.0, 1.0);
    vec4 clipEnd   = u_projection * vec4(a_end,   0.0, 1.0);

    // Segment direction in pixel space (always correct, no data-space
    // scale issues because the projection is already applied)
    vec2 pixelStart = clipStart.xy * u_resolution * 0.5;
    vec2 pixelEnd   = clipEnd.xy   * u_resolution * 0.5;

    vec2 dir = pixelEnd - pixelStart;
    float segLen = length(dir);
    dir = segLen > 0.001 ? dir / segLen : vec2(1.0, 0.0);

    // Perpendicular in pixel space
    vec2 normal = vec2(-dir.y, dir.x);

    // Decode corner index
    float isEnd = step(1.5, a_corner);               // 0 for start, 1 for end
    float side  = 1.0 - mod(a_corner, 2.0) * 2.0;   // +1 left, -1 right

    vec4 clipPos = mix(clipStart, clipEnd, isEnd);

    // Offset perpendicular to segment, constant pixel width
    float halfWidth = (u_line_width + 1.5) * 0.5;
    vec2 clipOffset = (normal * side * halfWidth) / (u_resolution * 0.5);

    gl_Position = clipPos + vec4(clipOffset, 0.0, 0.0);
    v_edge_dist = side;
}
