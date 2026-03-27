export const breakpoints = {
  // Responsive breakpoints
  xs: '576px',    // Extra small screens
  sm: '768px',    // Small screens (tablets)
  md: '992px',    // Medium screens (small laptops)
  lg: '1200px',   // Large screens (desktops)
  xl: '1400px',   // Extra large screens
  '2xl': '1600px', // 2X large screens
  
  // Container max widths
  container: {
    xs: '100%',
    sm: '540px',
    md: '720px',
    lg: '960px',
    xl: '1140px',
    '2xl': '1320px',
  },
  
  // Grid breakpoints for responsive design
  grid: {
    cols: {
      xs: 1,
      sm: 2,
      md: 3,
      lg: 4,
      xl: 5,
      '2xl': 6,
    },
  },
};

export default breakpoints;
