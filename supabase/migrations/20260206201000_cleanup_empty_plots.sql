-- Permanent cleanup of empty plots in all regions
DELETE FROM public.region_plots WHERE plot_type = 'empty';
