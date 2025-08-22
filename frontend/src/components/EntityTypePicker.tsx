import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Collapse,
  Paper,
  Stack,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Business as BusinessIcon,
  Badge as BadgeIcon,
  LocationOn as LocationIcon,
  Cake as CakeIcon,
  VpnKey as VpnKeyIcon,
  Inventory as InventoryIcon,
  MiscellaneousServices as ServiceIcon,
  Assignment as ProjectIcon,
} from '@mui/icons-material';

interface EntityTypePickerProps {
  value: string;
  onChange: (value: string) => void;
  entityTypes: Array<{type: string, label: string, placeholder: string}>;
  disabled?: boolean;
}

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'name': return <PersonIcon sx={{ fontSize: 16 }} />;
    case 'email': return <EmailIcon sx={{ fontSize: 16 }} />;
    case 'phone': return <PhoneIcon sx={{ fontSize: 16 }} />;
    case 'address': return <HomeIcon sx={{ fontSize: 16 }} />;
    case 'location': return <LocationIcon sx={{ fontSize: 16 }} />;
    case 'org': return <BusinessIcon sx={{ fontSize: 16 }} />;
    case 'id': return <BadgeIcon sx={{ fontSize: 16 }} />;
    case 'ssn': return <VpnKeyIcon sx={{ fontSize: 16 }} />;
    case 'birth-date': return <CakeIcon sx={{ fontSize: 16 }} />;
    case 'proprietary': return <SecurityIcon sx={{ fontSize: 16 }} />;
    case 'product': return <InventoryIcon sx={{ fontSize: 16 }} />;
    case 'service': return <ServiceIcon sx={{ fontSize: 16 }} />;
    case 'project': return <ProjectIcon sx={{ fontSize: 16 }} />;
    default: return <SecurityIcon sx={{ fontSize: 16 }} />;
  }
};

const EntityTypePicker: React.FC<EntityTypePickerProps> = ({
  value,
  onChange,
  entityTypes,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  
  const selectedType = entityTypes.find(t => t.type === value) || entityTypes[0];

  const handleSelect = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  return (
    <Box 
      className="entity-type-picker"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }} display="block">
        Tag as Entity Type
      </Typography>
      
      <Paper
        sx={{
          bgcolor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <ListItemButton
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen(!open);
          }}
          disabled={disabled}
          sx={{
            py: 0.5,
            px: 1,
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'white' }}>
            {getEntityIcon(selectedType.type)}
          </ListItemIcon>
          <ListItemText 
            primary={selectedType.label}
            secondary={`[${selectedType.placeholder}]`}
            primaryTypographyProps={{
              fontSize: '0.875rem',
              color: 'white',
            }}
            secondaryTypographyProps={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.5)',
            }}
          />
          {open ? <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />}
        </ListItemButton>
        
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List 
            component="div" 
            disablePadding
            sx={{
              maxHeight: 250,
              overflowY: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.2)',
              bgcolor: 'rgba(0,0,0,0.3)',
            }}
          >
            {entityTypes.map((type) => (
              <ListItemButton
                key={type.type}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(type.type);
                }}
                selected={type.type === value}
                sx={{
                  py: 0.5,
                  px: 1,
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(59, 130, 246, 0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(59, 130, 246, 0.3)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, color: 'white' }}>
                  {getEntityIcon(type.type)}
                </ListItemIcon>
                <ListItemText 
                  primary={type.label}
                  secondary={`[${type.placeholder}]`}
                  primaryTypographyProps={{
                    fontSize: '0.813rem',
                    color: 'white',
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.7rem',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default EntityTypePicker;