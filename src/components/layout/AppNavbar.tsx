import { NavLink } from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function AppNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <NavLink
        label="Dashboard"
        active={isActive('/dashboard')}
        onClick={() => navigate('/dashboard')}
      />
      <NavLink
        label="Funders"
        active={isActive('/funders')}
        onClick={() => navigate('/funders')}
      />
      <NavLink
        label="Opportunities"
        active={isActive('/opportunities')}
        onClick={() => navigate('/opportunities')}
      />
      <NavLink
        label="Applications"
        active={isActive('/applications')}
        onClick={() => navigate('/applications')}
      />
      <NavLink
        label="Templates"
        active={isActive('/templates')}
        onClick={() => navigate('/templates')}
      />
      <NavLink
        label="Contacts"
        active={isActive('/contacts')}
        onClick={() => navigate('/contacts')}
      />
      <NavLink
        label="Interactions"
        active={isActive('/interactions')}
        onClick={() => navigate('/interactions')}
      />
      <NavLink
        label="Import"
        active={isActive('/import')}
        onClick={() => navigate('/import')}
      />
      {user?.role === 'ADMIN' && (
        <NavLink
          label="Admin"
          childrenOffset={28}
        >
          <NavLink
            label="Users"
            active={isActive('/admin/users')}
            onClick={() => navigate('/admin/users')}
          />
        </NavLink>
      )}
    </>
  );
}
