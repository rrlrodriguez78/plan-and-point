/**
 * Accessibility Skip Link Component
 * Allows keyboard users to skip navigation and jump directly to main content
 * Required for WCAG 2.1 AA compliance
 */

export const A11ySkipLink = () => {
  return (
    <a
      href="#main-content"
      className="skip-to-main bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
};
