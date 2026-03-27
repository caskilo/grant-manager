import { MantineTheme } from '@mantine/core';

export const componentStyles = {
  Button: {
    defaultProps: {
      radius: 'md',
      variant: 'light',
    },
    styles: () => ({
      root: {
        fontWeight: 500,
        transition: 'all 0.2s ease',
      },
    }),
  },
  Card: {
    defaultProps: {
      radius: 'lg',
      withBorder: true,
      shadow: 'sm',
    },
    styles: () => ({
      root: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  Badge: {
    defaultProps: {
      radius: 'sm',
      variant: 'light',
    },
    styles: () => ({
      root: {
        fontWeight: 600,
        textTransform: 'none',
      },
    }),
  },
  Paper: {
    defaultProps: {
      radius: 'md',
      shadow: 'sm',
    },
  },
  Title: {
    styles: () => ({
      root: {
        fontWeight: 600,
      },
    }),
  },
  Text: {
    styles: () => ({
      root: {
        lineHeight: 1.6,
      },
    }),
  },
  NavLink: {
    styles: (theme: MantineTheme) => ({
      root: {
        borderRadius: theme.radius.md,
        margin: '2px 4px',
        transition: 'all 0.2s ease',
        '&[data-active]': {
          backgroundColor: theme.colors.odyssean[0],
          color: theme.white,
        },
      },
    }),
  },
};

export default componentStyles;
