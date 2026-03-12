export interface ICMScript {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const ICM_RUBY_SCRIPTS: ICMScript[] = [
  {
    id: "script1",
    title: "Script 1: RTK Field Discovery",
    description: "Scan the current network and list all RTK/RDII/UH-related fields. Run this first to discover exact field names in your ICM version.",
    code: `# ============================================================================
# SCRIPT 1: RTK Field Discovery
# Purpose:  Scan the current network and list all RTK/RDII/UH-related fields
#           Works for both InfoWorks and SWMM networks
# Usage:    Open a network in ICM, run from the Ruby scripting console
# ============================================================================

net = WSApplication.current_network

puts "=" * 80
puts "RTK / RDII FIELD DISCOVERY"
puts "=" * 80
puts "Network: \#{net.path}" rescue puts "Network path not available"
puts "Time: \#{Time.now}"
puts ""

# ---------------------------------------------------------------------------
# Helper: scan a table for fields containing RTK-related keywords
# ---------------------------------------------------------------------------
def scan_table_for_rtk_fields(net, table_name, keywords)
  results = []
  begin
    objects = net.row_objects(table_name)
    if objects && objects.length > 0
      sample = objects[0]
      fields = []
      begin
        fields = sample.fields rescue sample.table_info.fields rescue []
      rescue
      end
      
      if fields.respond_to?(:each)
        fields.each do |f|
          fname = f.respond_to?(:name) ? f.name : f.to_s
          keywords.each do |kw|
            if fname.downcase.include?(kw.downcase)
              val = sample[fname] rescue "N/A"
              results << { table: table_name, field: fname, sample_value: val }
            end
          end
        end
      end
      
      puts "  \#{table_name}: \#{objects.length} objects found"
    else
      puts "  \#{table_name}: empty or not present"
    end
  rescue => e
    puts "  \#{table_name}: not available (\#{e.message})"
  end
  results
end

# ---------------------------------------------------------------------------
# Keywords that indicate RTK/RDII/Unit Hydrograph data
# ---------------------------------------------------------------------------
rtk_keywords = [
  'rtk', 'rdii', 'unit_hydrograph', 'hydrograph', 'uh_group',
  'sewer_area', 'contributing_area', 'rainfall_profile',
  'r1', 'r2', 'r3', 't1', 't2', 't3', 'k1', 'k2', 'k3',
  'r_short', 'r_medium', 'r_long',
  't_short', 't_medium', 't_long',
  'k_short', 'k_medium', 'k_long',
  'ia_max', 'ia_init', 'ia_recovery', 'abstraction',
  'max_depth_short', 'max_depth_medium', 'max_depth_long',
  'recovery_rate', 'starting_depth',
  'dmax', 'drec', 'd0'
]

# ---------------------------------------------------------------------------
# Tables to scan — InfoWorks and SWMM
# ---------------------------------------------------------------------------
iw_tables = [
  'hw_subcatchment', 'hw_node', 'hw_conduit',
  'hw_rtk_hydrograph', 'hw_unit_hydrograph',
  'subcatchment', 'node', 'conduit',
  '_subcatchments', '_nodes', '_links'
]

sw_tables = [
  'sw_subcatchment', 'sw_node', 'sw_junction', 'sw_outfall',
  'sw_conduit', 'sw_pump', 'sw_orifice', 'sw_weir',
  'sw_unit_hydrograph', 'sw_hydrograph', 'sw_rdii',
  'sw_storage'
]

all_tables = iw_tables + sw_tables

puts "Scanning InfoWorks tables..."
puts "-" * 40
all_rtk_fields = []

all_tables.each do |tbl|
  found = scan_table_for_rtk_fields(net, tbl, rtk_keywords)
  all_rtk_fields.concat(found)
end

puts ""
puts "=" * 80
puts "RTK-RELATED FIELDS FOUND"
puts "=" * 80

if all_rtk_fields.empty?
  puts "No RTK fields found automatically."
  puts "Try examining subcatchment objects manually:"
  puts ""
  puts "  net.row_objects('hw_subcatchment').each do |sc|"
  puts "    puts sc.id"
  puts "    ['r1','t1','k1','rtk_r1'].each do |f|"
  puts "      puts \\"  \#{f}: \#{sc[f]}\\" rescue nil"
  puts "    end"
  puts "  end"
else
  all_rtk_fields.each do |r|
    puts "  Table: %-25s  Field: %-30s  Sample: %s" % [r[:table], r[:field], r[:sample_value]]
  end
end

puts ""
puts "=" * 80
puts "OBJECT COUNTS"
puts "=" * 80

count_tables = {
  'hw_subcatchment'     => 'InfoWorks Subcatchments',
  'hw_node'             => 'InfoWorks Nodes',
  'hw_conduit'          => 'InfoWorks Conduits',
  'sw_subcatchment'     => 'SWMM Subcatchments',
  'sw_node'             => 'SWMM Nodes',
  'sw_conduit'          => 'SWMM Conduits',
  'sw_unit_hydrograph'  => 'SWMM Unit Hydrographs'
}

count_tables.each do |tbl, label|
  begin
    objs = net.row_objects(tbl)
    count = objs ? objs.length : 0
    puts "  %-30s  %d objects" % [label, count] if count > 0
  rescue
  end
end

puts ""
puts "Discovery complete."`,
  },
  {
    id: "script2",
    title: "Script 2: InfoWorks RTK Extractor",
    description: "Extract all RTK parameters from InfoWorks subcatchments including monthly variations and initial abstraction. Outputs CSV + SWMM5 INP.",
    code: `# ============================================================================
# SCRIPT 2: InfoWorks ICM — RTK Hydrograph Extraction
# Purpose:  Extract all RTK parameters from InfoWorks subcatchments
#           including monthly variations and initial abstraction
# Output:   CSV file + SWMM5 INP sections + console summary
# ============================================================================

net = WSApplication.current_network

# ---------------------------------------------------------------------------
# Configuration — adjust output path as needed
# ---------------------------------------------------------------------------
OUTPUT_DIR   = 'C:/SSOAP/exports'         # Change to your preferred directory
TIMESTAMP    = Time.now.strftime('%Y%m%d_%H%M%S')
CSV_FILE     = "\#{OUTPUT_DIR}/iw_rtk_export_\#{TIMESTAMP}.csv"
INP_FILE     = "\#{OUTPUT_DIR}/iw_rtk_hydrographs_\#{TIMESTAMP}.inp"

Dir.mkdir(OUTPUT_DIR) rescue nil

# ---------------------------------------------------------------------------
# RTK field name mapping — InfoWorks subcatchments
# ---------------------------------------------------------------------------
RTK_FIELDS = {
  id:                   'id',
  node_id:              'node_id',
  rtk_group:            'rtk_hydrograph',
  rainfall_profile:     'rainfall_profile',
  contributing_area:    'contributing_area',
  total_area:           'total_area',
  r1: 'r1', t1: 't1', k1: 'k1',
  ia_max_short:         'max_depth_short',
  ia_recovery_short:    'recovery_rate_short',
  ia_init_short:        'starting_depth_short',
  r2: 'r2', t2: 't2', k2: 'k2',
  ia_max_medium:        'max_depth_medium',
  ia_recovery_medium:   'recovery_rate_medium',
  ia_init_medium:       'starting_depth_medium',
  r3: 'r3', t3: 't3', k3: 'k3',
  ia_max_long:          'max_depth_long',
  ia_recovery_long:     'recovery_rate_long',
  ia_init_long:         'starting_depth_long'
}

MONTHS = %w[January February March April May June July August September October November December]
MONTH_ABBREV = %w[JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC]

def safe_read(obj, field_name)
  begin; val = obj[field_name]; return val; rescue; return nil; end
end

def try_fields(obj, *field_names)
  field_names.each do |fn|
    val = safe_read(obj, fn)
    return val unless val.nil?
  end
  nil
end

puts "=" * 80
puts "INFOWORKS RTK HYDROGRAPH EXTRACTION"
puts "=" * 80

subcatchments = nil
table_name = nil

['hw_subcatchment', 'subcatchment', '_subcatchments'].each do |tbl|
  begin
    subcatchments = net.row_objects(tbl)
    if subcatchments && subcatchments.length > 0
      table_name = tbl
      break
    end
  rescue
    next
  end
end

if subcatchments.nil? || subcatchments.length == 0
  puts "ERROR: No subcatchments found. For SWMM networks, use Script 3."
  exit
end

puts "Found \#{subcatchments.length} subcatchments in '\#{table_name}'"

rtk_data = []
rtk_groups = {}
subcatchments_with_rtk = 0
subcatchments_without_rtk = 0

subcatchments.each do |sc|
  sc_id = sc.id
  node_id    = try_fields(sc, 'node_id', 'us_node_id', 'outlet_node', 'downstream_node')
  rtk_group  = try_fields(sc, 'rtk_hydrograph', 'rtk_group', 'unit_hydrograph', 'uh_group')
  rain_prof  = try_fields(sc, 'rainfall_profile', 'rain_gage', 'raingage')
  cont_area  = try_fields(sc, 'contributing_area', 'sewer_area', 'rdii_area')
  total_area = try_fields(sc, 'total_area', 'area')

  r1 = try_fields(sc, 'r1', 'rtk_r1', 'r_short')
  t1 = try_fields(sc, 't1', 'rtk_t1', 't_short')
  k1 = try_fields(sc, 'k1', 'rtk_k1', 'k_short')
  r2 = try_fields(sc, 'r2', 'rtk_r2', 'r_medium')
  t2 = try_fields(sc, 't2', 'rtk_t2', 't_medium')
  k2 = try_fields(sc, 'k2', 'rtk_k2', 'k_medium')
  r3 = try_fields(sc, 'r3', 'rtk_r3', 'r_long')
  t3 = try_fields(sc, 't3', 'rtk_t3', 't_long')
  k3 = try_fields(sc, 'k3', 'rtk_k3', 'k_long')

  ia_max_s  = try_fields(sc, 'max_depth_short', 'ia_max_short', 'dmax1')
  ia_max_m  = try_fields(sc, 'max_depth_medium', 'ia_max_medium', 'dmax2')
  ia_max_l  = try_fields(sc, 'max_depth_long', 'ia_max_long', 'dmax3')
  ia_rec_s  = try_fields(sc, 'recovery_rate_short', 'ia_recovery_short', 'drec1')
  ia_rec_m  = try_fields(sc, 'recovery_rate_medium', 'ia_recovery_medium', 'drec2')
  ia_rec_l  = try_fields(sc, 'recovery_rate_long', 'ia_recovery_long', 'drec3')
  ia_init_s = try_fields(sc, 'starting_depth_short', 'ia_init_short', 'd01')
  ia_init_m = try_fields(sc, 'starting_depth_medium', 'ia_init_medium', 'd02')
  ia_init_l = try_fields(sc, 'starting_depth_long', 'ia_init_long', 'd03')

  has_rtk = (r1 && r1.to_f > 0) || (r2 && r2.to_f > 0) || (r3 && r3.to_f > 0) ||
            (rtk_group && rtk_group.to_s.strip.length > 0)

  if has_rtk
    subcatchments_with_rtk += 1
    r_total = (r1.to_f + r2.to_f + r3.to_f)
    record = {
      sc_id: sc_id, node_id: node_id, rtk_group: rtk_group,
      rainfall_prof: rain_prof, cont_area: cont_area.to_f, total_area: total_area.to_f,
      r1: r1.to_f, t1: t1.to_f, k1: k1.to_f,
      r2: r2.to_f, t2: t2.to_f, k2: k2.to_f,
      r3: r3.to_f, t3: t3.to_f, k3: k3.to_f,
      r_total: r_total,
      ia_max_s: ia_max_s.to_f, ia_max_m: ia_max_m.to_f, ia_max_l: ia_max_l.to_f,
      ia_rec_s: ia_rec_s.to_f, ia_rec_m: ia_rec_m.to_f, ia_rec_l: ia_rec_l.to_f,
      ia_init_s: ia_init_s.to_f, ia_init_m: ia_init_m.to_f, ia_init_l: ia_init_l.to_f
    }
    rtk_data << record
    grp = rtk_group.to_s.strip
    rtk_groups[grp] = [] unless rtk_groups.key?(grp)
    rtk_groups[grp] << sc_id
  else
    subcatchments_without_rtk += 1
  end
end

# Export to CSV
begin
  File.open(CSV_FILE, 'w') do |f|
    f.puts ['Subcatchment_ID','Node_ID','RTK_Group','Rainfall_Profile',
            'Contributing_Area','Total_Area',
            'R1','T1_hr','K1','R2','T2_hr','K2','R3','T3_hr','K3','R_Total',
            'IA_Max_Short','IA_Max_Medium','IA_Max_Long',
            'IA_Recovery_Short','IA_Recovery_Medium','IA_Recovery_Long',
            'IA_Init_Short','IA_Init_Medium','IA_Init_Long'].join(',')
    rtk_data.each do |r|
      f.puts [r[:sc_id],r[:node_id],r[:rtk_group],r[:rainfall_prof],
              r[:cont_area],r[:total_area],
              r[:r1],r[:t1],r[:k1],r[:r2],r[:t2],r[:k2],r[:r3],r[:t3],r[:k3],
              r[:r_total],
              r[:ia_max_s],r[:ia_max_m],r[:ia_max_l],
              r[:ia_rec_s],r[:ia_rec_m],r[:ia_rec_l],
              r[:ia_init_s],r[:ia_init_m],r[:ia_init_l]].join(',')
    end
  end
  puts "CSV exported to: \#{CSV_FILE}"
rescue => e
  puts "CSV export error: \#{e.message}"
end

# Export SWMM5 INP [HYDROGRAPHS] and [RDII] sections
begin
  File.open(INP_FILE, 'w') do |f|
    f.puts ";; SWMM5 RTK Hydrograph Data — Extracted from InfoWorks ICM"
    f.puts ";; Date: \#{Time.now}"
    f.puts ""
    f.puts "[HYDROGRAPHS]"
    f.puts ";;Name           Month      Response   R        T        K        Dmax     Drec     D0"
    written_groups = {}
    rtk_data.each do |r|
      grp = r[:rtk_group].to_s.strip
      grp = "UH_\#{r[:sc_id]}" if grp.empty?
      next if written_groups.key?(grp)
      written_groups[grp] = true
      f.puts "%-16s %-10s SHORT      %-8.4f %-8.2f %-8.2f %-8.4f %-8.4f %-8.4f" %
             [grp, 'ALL', r[:r1], r[:t1], r[:k1], r[:ia_max_s], r[:ia_rec_s], r[:ia_init_s]]
      f.puts "%-16s %-10s MEDIUM     %-8.4f %-8.2f %-8.2f %-8.4f %-8.4f %-8.4f" %
             [grp, 'ALL', r[:r2], r[:t2], r[:k2], r[:ia_max_m], r[:ia_rec_m], r[:ia_init_m]]
      f.puts "%-16s %-10s LONG       %-8.4f %-8.2f %-8.2f %-8.4f %-8.4f %-8.4f" %
             [grp, 'ALL', r[:r3], r[:t3], r[:k3], r[:ia_max_l], r[:ia_rec_l], r[:ia_init_l]]
    end
    f.puts ""
    f.puts "[RDII]"
    f.puts ";;Node           UHGroup          SewerArea"
    rtk_data.each do |r|
      node = r[:node_id].to_s.strip
      next if node.empty?
      grp = r[:rtk_group].to_s.strip
      grp = "UH_\#{r[:sc_id]}" if grp.empty?
      area = r[:cont_area] > 0 ? r[:cont_area] : r[:total_area]
      f.puts "%-16s %-16s %.2f" % [node, grp, area]
    end
  end
  puts "INP exported to: \#{INP_FILE}"
rescue => e
  puts "INP export error: \#{e.message}"
end

puts ""
puts "Results: \#{subcatchments_with_rtk} with RTK, \#{subcatchments_without_rtk} without"
puts "InfoWorks RTK extraction complete."`,
  },
  {
    id: "script3",
    title: "Script 3: ICM SWMM UH & RDII Extractor",
    description: "Extract RTK parameters from SWMM network objects in ICM. SWMM stores UH groups separately from nodes. Outputs CSV + SWMM5 INP.",
    code: `# ============================================================================
# SCRIPT 3: ICM SWMM — Unit Hydrograph & RDII Extraction
# Purpose:  Extract RTK parameters from SWMM network objects in ICM
#           SWMM stores UH groups separately from nodes; nodes reference them
# Output:   CSV file + SWMM5 INP sections + console summary
# ============================================================================

net = WSApplication.current_network

OUTPUT_DIR = 'C:/SSOAP/exports'
TIMESTAMP  = Time.now.strftime('%Y%m%d_%H%M%S')
CSV_UH     = "\#{OUTPUT_DIR}/sw_unit_hydrographs_\#{TIMESTAMP}.csv"
CSV_RDII   = "\#{OUTPUT_DIR}/sw_rdii_nodes_\#{TIMESTAMP}.csv"
INP_FILE   = "\#{OUTPUT_DIR}/sw_rtk_complete_\#{TIMESTAMP}.inp"

Dir.mkdir(OUTPUT_DIR) rescue nil

def safe_read(obj, field_name)
  begin; obj[field_name]; rescue; nil; end
end

def try_fields(obj, *field_names)
  field_names.each do |fn|
    val = safe_read(obj, fn)
    return val unless val.nil?
  end
  nil
end

MONTH_ABBREV = %w[JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC]

puts "=" * 80
puts "ICM SWMM — UNIT HYDROGRAPH & RDII EXTRACTION"
puts "=" * 80

# PART A: Unit Hydrograph Groups
uh_data = []
['sw_unit_hydrograph', 'sw_hydrograph', 'sw_rdii_hydrograph'].each do |tbl|
  begin
    objects = net.row_objects(tbl)
    next unless objects && objects.length > 0

    objects.each do |uh|
      uh_id = uh.id
      rain_gage = try_fields(uh, 'rain_gage', 'raingage', 'rainfall_profile')
      r1 = try_fields(uh, 'r1', 'r_short').to_f
      t1 = try_fields(uh, 't1', 't_short').to_f
      k1 = try_fields(uh, 'k1', 'k_short').to_f
      r2 = try_fields(uh, 'r2', 'r_medium').to_f
      t2 = try_fields(uh, 't2', 't_medium').to_f
      k2 = try_fields(uh, 'k2', 'k_medium').to_f
      r3 = try_fields(uh, 'r3', 'r_long').to_f
      t3 = try_fields(uh, 't3', 't_long').to_f
      k3 = try_fields(uh, 'k3', 'k_long').to_f
      ia_max_s  = try_fields(uh, 'dmax1', 'ia_max_short').to_f
      ia_max_m  = try_fields(uh, 'dmax2', 'ia_max_medium').to_f
      ia_max_l  = try_fields(uh, 'dmax3', 'ia_max_long').to_f
      ia_rec_s  = try_fields(uh, 'drec1', 'ia_recovery_short').to_f
      ia_rec_m  = try_fields(uh, 'drec2', 'ia_recovery_medium').to_f
      ia_rec_l  = try_fields(uh, 'drec3', 'ia_recovery_long').to_f
      ia_init_s = try_fields(uh, 'd01', 'ia_init_short').to_f
      ia_init_m = try_fields(uh, 'd02', 'ia_init_medium').to_f
      ia_init_l = try_fields(uh, 'd03', 'ia_init_long').to_f

      uh_data << {
        uh_id: uh_id, rain_gage: rain_gage, month: 'ALL',
        r1: r1, t1: t1, k1: k1, r2: r2, t2: t2, k2: k2, r3: r3, t3: t3, k3: k3,
        ia_max_s: ia_max_s, ia_max_m: ia_max_m, ia_max_l: ia_max_l,
        ia_rec_s: ia_rec_s, ia_rec_m: ia_rec_m, ia_rec_l: ia_rec_l,
        ia_init_s: ia_init_s, ia_init_m: ia_init_m, ia_init_l: ia_init_l
      }

      MONTH_ABBREV.each_with_index do |mon, mi|
        r1m = try_fields(uh, "r1_\#{mon.downcase}", "r1_m\#{mi+1}")
        r2m = try_fields(uh, "r2_\#{mon.downcase}", "r2_m\#{mi+1}")
        r3m = try_fields(uh, "r3_\#{mon.downcase}", "r3_m\#{mi+1}")
        if r1m || r2m || r3m
          uh_data << {
            uh_id: uh_id, rain_gage: rain_gage, month: mon,
            r1: r1m.to_f, t1: try_fields(uh,"t1_\#{mon.downcase}").to_f,
            k1: try_fields(uh,"k1_\#{mon.downcase}").to_f,
            r2: r2m.to_f, t2: try_fields(uh,"t2_\#{mon.downcase}").to_f,
            k2: try_fields(uh,"k2_\#{mon.downcase}").to_f,
            r3: r3m.to_f, t3: try_fields(uh,"t3_\#{mon.downcase}").to_f,
            k3: try_fields(uh,"k3_\#{mon.downcase}").to_f,
            ia_max_s: ia_max_s, ia_max_m: ia_max_m, ia_max_l: ia_max_l,
            ia_rec_s: ia_rec_s, ia_rec_m: ia_rec_m, ia_rec_l: ia_rec_l,
            ia_init_s: ia_init_s, ia_init_m: ia_init_m, ia_init_l: ia_init_l
          }
        end
      end
    end
    break
  rescue => e
    puts "  Table '\#{tbl}': \#{e.message}"
  end
end

# PART B: RDII Node Assignments
rdii_nodes = []
['sw_node', 'sw_junction'].each do |tbl|
  begin
    nodes = net.row_objects(tbl)
    next unless nodes && nodes.length > 0
    nodes.each do |node|
      uh_group   = try_fields(node, 'unit_hydrograph', 'uh_group', 'rdii_uh_group')
      sewer_area = try_fields(node, 'sewer_area', 'rdii_sewer_area', 'contributing_area')
      r1 = try_fields(node, 'r1', 'rtk_r1', 'rdii_r1')
      has_rdii = (uh_group && uh_group.to_s.strip.length > 0) ||
                 (sewer_area && sewer_area.to_f > 0) || (r1 && r1.to_f > 0)
      if has_rdii
        rdii_nodes << {
          node_id: node.id, uh_group: uh_group.to_s.strip,
          sewer_area: sewer_area.to_f,
          invert: try_fields(node, 'invert_elevation', 'invert').to_f,
          max_depth: try_fields(node, 'max_depth', 'depth').to_f
        }
      end
    end
    break if rdii_nodes.length > 0
  rescue => e
    puts "  Table '\#{tbl}': \#{e.message}"
  end
end

puts "UH groups: \#{uh_data.select{|u| u[:month]=='ALL'}.length}"
puts "RDII nodes: \#{rdii_nodes.length}"

# Export CSVs and INP
begin
  File.open(CSV_UH, 'w') do |f|
    f.puts ['UH_Group','Rain_Gage','Month','R1','T1_hr','K1','R2','T2_hr','K2',
            'R3','T3_hr','K3'].join(',')
    uh_data.each do |u|
      f.puts [u[:uh_id],u[:rain_gage],u[:month],
              u[:r1],u[:t1],u[:k1],u[:r2],u[:t2],u[:k2],
              u[:r3],u[:t3],u[:k3]].join(',')
    end
  end
  puts "UH CSV: \#{CSV_UH}"
rescue => e
  puts "UH CSV error: \#{e.message}"
end

begin
  File.open(INP_FILE, 'w') do |f|
    f.puts ";; SWMM5 RDII & UH Data — Extracted from ICM SWMM"
    f.puts "[HYDROGRAPHS]"
    uh_data.each do |u|
      f.puts "%-16s %-10s SHORT      %-8.4f %-8.2f %-8.2f" % [u[:uh_id], u[:month], u[:r1], u[:t1], u[:k1]]
      f.puts "%-16s %-10s MEDIUM     %-8.4f %-8.2f %-8.2f" % [u[:uh_id], u[:month], u[:r2], u[:t2], u[:k2]]
      f.puts "%-16s %-10s LONG       %-8.4f %-8.2f %-8.2f" % [u[:uh_id], u[:month], u[:r3], u[:t3], u[:k3]]
    end
    f.puts ""
    f.puts "[RDII]"
    rdii_nodes.each do |n|
      grp = n[:uh_group].empty? ? "UH_\#{n[:node_id]}" : n[:uh_group]
      f.puts "%-16s %-16s %.2f" % [n[:node_id], grp, n[:sewer_area]]
    end
  end
  puts "INP: \#{INP_FILE}"
rescue => e
  puts "INP error: \#{e.message}"
end

puts "ICM SWMM RTK extraction complete."`,
  },
  {
    id: "script4",
    title: "Script 4: Unified Extractor (Auto-Detect)",
    description: "Single script that auto-detects InfoWorks or SWMM network type and exports JSON compatible with SSOAP Toolbox import.",
    code: `# ============================================================================
# SCRIPT 4: Unified RTK Extractor — Auto-detects InfoWorks or SWMM network
# Purpose:  Single script that works with either network type
#           Exports to JSON for the SSOAP Toolbox web application
# Output:   JSON file compatible with SSOAP Toolbox import
# ============================================================================

net = WSApplication.current_network

OUTPUT_DIR = 'C:/SSOAP/exports'
TIMESTAMP  = Time.now.strftime('%Y%m%d_%H%M%S')
JSON_FILE  = "\#{OUTPUT_DIR}/rtk_export_\#{TIMESTAMP}.json"

Dir.mkdir(OUTPUT_DIR) rescue nil

def safe_read(obj, fn)
  begin; obj[fn]; rescue; nil; end
end

def try_fields(obj, *names)
  names.each { |n| v = safe_read(obj, n); return v unless v.nil? }
  nil
end

MONTH_ABBREV = %w[JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC]

# Detect network type
network_type = :unknown
iw_count = 0; sw_count = 0
begin; objs = net.row_objects('hw_subcatchment'); iw_count = objs.length if objs; rescue; end
begin; objs = net.row_objects('sw_node'); sw_count = objs.length if objs; rescue; end

if iw_count > 0 && sw_count == 0
  network_type = :infoworks
elsif sw_count > 0 && iw_count == 0
  network_type = :swmm
elsif iw_count > 0 && sw_count > 0
  network_type = :both
end

puts "Detected network type: \#{network_type.to_s.upcase}"

export_data = {
  metadata: { export_date: Time.now.to_s, network_type: network_type.to_s,
              source: 'ICM Exchange Ruby Script v1.0' },
  unit_hydrographs: [], rdii_assignments: [], subcatchments: [], statistics: {}
}

# Extract from InfoWorks
if network_type == :infoworks || network_type == :both
  begin
    subcatchments = net.row_objects('hw_subcatchment')
    subcatchments.each do |sc|
      r1 = try_fields(sc, 'r1', 'rtk_r1').to_f
      r2 = try_fields(sc, 'r2', 'rtk_r2').to_f
      r3 = try_fields(sc, 'r3', 'rtk_r3').to_f
      rtk_group = try_fields(sc, 'rtk_hydrograph', 'rtk_group')
      next unless r1 > 0 || r2 > 0 || r3 > 0 || (rtk_group && rtk_group.to_s.strip.length > 0)

      node_id = try_fields(sc, 'node_id', 'us_node_id')
      cont_area = try_fields(sc, 'contributing_area', 'sewer_area').to_f
      tot_area = try_fields(sc, 'total_area', 'area').to_f

      export_data[:subcatchments] << {
        source: 'infoworks', subcatchment_id: sc.id, node_id: node_id,
        rtk_group: rtk_group, contributing_area: cont_area,
        rtk: { r: [r1, r2, r3],
               t: [try_fields(sc,'t1').to_f, try_fields(sc,'t2').to_f, try_fields(sc,'t3').to_f],
               k: [try_fields(sc,'k1').to_f, try_fields(sc,'k2').to_f, try_fields(sc,'k3').to_f],
               r_total: r1 + r2 + r3 }
      }
      if node_id
        export_data[:rdii_assignments] << {
          node_id: node_id, uh_group: rtk_group || "UH_\#{sc.id}",
          sewer_area: cont_area > 0 ? cont_area : tot_area
        }
      end
    end
    puts "InfoWorks: \#{export_data[:subcatchments].length} subcatchments with RTK"
  rescue => e
    puts "InfoWorks error: \#{e.message}"
  end
end

# Extract from SWMM
if network_type == :swmm || network_type == :both
  ['sw_unit_hydrograph', 'sw_hydrograph'].each do |tbl|
    begin
      uh_objects = net.row_objects(tbl)
      next unless uh_objects && uh_objects.length > 0
      uh_objects.each do |uh|
        export_data[:unit_hydrographs] << {
          source: 'swmm', uh_id: uh.id, month: 'ALL',
          rtk: { r: [try_fields(uh,'r1').to_f, try_fields(uh,'r2').to_f, try_fields(uh,'r3').to_f],
                 t: [try_fields(uh,'t1').to_f, try_fields(uh,'t2').to_f, try_fields(uh,'t3').to_f],
                 k: [try_fields(uh,'k1').to_f, try_fields(uh,'k2').to_f, try_fields(uh,'k3').to_f] }
        }
      end
      puts "SWMM: \#{uh_objects.length} UH groups"
      break
    rescue; next; end
  end
  ['sw_node', 'sw_junction'].each do |tbl|
    begin
      nodes = net.row_objects(tbl)
      next unless nodes && nodes.length > 0
      nodes.each do |node|
        uh_group = try_fields(node, 'unit_hydrograph', 'uh_group')
        sewer_area = try_fields(node, 'sewer_area', 'rdii_sewer_area').to_f
        next unless (uh_group && uh_group.to_s.strip.length > 0) || sewer_area > 0
        export_data[:rdii_assignments] << {
          node_id: node.id, uh_group: uh_group.to_s.strip, sewer_area: sewer_area
        }
      end
      break
    rescue; next; end
  end
end

# JSON export (manual — ICM Ruby may not have json gem)
def to_json_value(val)
  case val
  when nil then 'null'
  when String then '"' + val.gsub('"', '\\\\"') + '"'
  when Symbol then '"' + val.to_s + '"'
  when Numeric then val.to_s
  when true, false then val.to_s
  when Array then '[' + val.map { |v| to_json_value(v) }.join(', ') + ']'
  when Hash then to_json_hash(val)
  else '"' + val.to_s + '"'
  end
end

def to_json_hash(hash, indent = 0)
  pad = '  ' * indent
  inner = '  ' * (indent + 1)
  lines = []
  hash.each do |k, v|
    if v.is_a?(Hash) then lines << "\#{inner}\\"\#{k}\\": \#{to_json_hash(v, indent+1)}"
    elsif v.is_a?(Array) && v.length > 0 && v[0].is_a?(Hash)
      arr = v.map { |item| to_json_hash(item, indent+2) }
      lines << "\#{inner}\\"\#{k}\\": [\\n\#{arr.join(",\\n")}\\n\#{inner}]"
    else lines << "\#{inner}\\"\#{k}\\": \#{to_json_value(v)}"
    end
  end
  "{\\n\#{lines.join(",\\n")}\\n\#{pad}}"
end

begin
  File.open(JSON_FILE, 'w') { |f| f.puts to_json_hash(export_data) }
  puts "JSON exported to: \#{JSON_FILE}"
  puts "(Import this file into the SSOAP Toolbox web application)"
rescue => e
  puts "JSON export error: \#{e.message}"
end

puts "Export complete."`,
  },
  {
    id: "script5",
    title: "Script 5: Compare InfoWorks vs SWMM RTK",
    description: "Verify RTK parameters match between InfoWorks and SWMM versions of the same model after conversion.",
    code: `# ============================================================================
# SCRIPT 5: Compare RTK Data Between InfoWorks and SWMM Networks
# Purpose:  When you have both an InfoWorks and SWMM version of the same
#           model (e.g., after conversion), verify RTK parameters match
# Usage:    Run with a network that has both IW and SWMM data in ICM
# ============================================================================

net = WSApplication.current_network

puts "=" * 80
puts "RTK COMPARISON: InfoWorks vs SWMM Network"
puts "=" * 80

def safe_read(obj, fn)
  begin; obj[fn]; rescue; nil; end
end

def try_fields(obj, *names)
  names.each { |n| v = safe_read(obj, n); return v unless v.nil? }
  nil
end

# Extract InfoWorks RTK
iw_rtk = {}
begin
  scs = net.row_objects('hw_subcatchment')
  if scs && scs.length > 0
    scs.each do |sc|
      node_id = try_fields(sc, 'node_id', 'us_node_id')
      r1 = try_fields(sc, 'r1', 'rtk_r1').to_f
      r2 = try_fields(sc, 'r2', 'rtk_r2').to_f
      r3 = try_fields(sc, 'r3', 'rtk_r3').to_f
      next unless r1 > 0 || r2 > 0 || r3 > 0
      key = node_id || sc.id
      iw_rtk[key] = {
        id: sc.id, node: node_id,
        area: try_fields(sc, 'contributing_area', 'sewer_area').to_f,
        r: [r1, r2, r3],
        t: [try_fields(sc,'t1').to_f, try_fields(sc,'t2').to_f, try_fields(sc,'t3').to_f],
        k: [try_fields(sc,'k1').to_f, try_fields(sc,'k2').to_f, try_fields(sc,'k3').to_f]
      }
    end
    puts "InfoWorks: \#{iw_rtk.length} subcatchments with RTK"
  end
rescue => e
  puts "InfoWorks: \#{e.message}"
end

# Extract SWMM RTK
sw_rtk = {}
uh_defs = {}
begin
  uhs = net.row_objects('sw_unit_hydrograph')
  if uhs && uhs.length > 0
    uhs.each do |uh|
      uh_defs[uh.id] = {
        r: [try_fields(uh,'r1').to_f, try_fields(uh,'r2').to_f, try_fields(uh,'r3').to_f],
        t: [try_fields(uh,'t1').to_f, try_fields(uh,'t2').to_f, try_fields(uh,'t3').to_f],
        k: [try_fields(uh,'k1').to_f, try_fields(uh,'k2').to_f, try_fields(uh,'k3').to_f]
      }
    end
  end
rescue; end

begin
  nodes = net.row_objects('sw_node')
  if nodes && nodes.length > 0
    nodes.each do |node|
      uh_group = try_fields(node, 'unit_hydrograph', 'uh_group')
      next unless uh_group && uh_group.to_s.strip.length > 0
      grp = uh_group.to_s.strip
      rtk = uh_defs[grp] || { r: [0,0,0], t: [0,0,0], k: [0,0,0] }
      sw_rtk[node.id] = {
        id: node.id, uh_group: grp,
        area: try_fields(node, 'sewer_area').to_f,
        r: rtk[:r], t: rtk[:t], k: rtk[:k]
      }
    end
    puts "SWMM: \#{sw_rtk.length} nodes with RDII"
  end
rescue => e
  puts "SWMM: \#{e.message}"
end

# Compare
if iw_rtk.length > 0 && sw_rtk.length > 0
  tolerance = 0.0001
  matches = 0; mismatches = 0; iw_only = 0; sw_only = 0
  all_keys = (iw_rtk.keys + sw_rtk.keys).uniq

  all_keys.sort.each do |key|
    iw = iw_rtk[key]; sw = sw_rtk[key]
    if iw && sw
      params = ['R1','R2','R3','T1','T2','T3','K1','K2','K3']
      iw_vals = iw[:r] + iw[:t] + iw[:k]
      sw_vals = sw[:r] + sw[:t] + sw[:k]
      node_match = true
      params.each_with_index do |p, i|
        diff = (iw_vals[i] - sw_vals[i]).abs
        unless diff <= tolerance
          puts "  \#{key}: \#{p} IW=\#{iw_vals[i]} SW=\#{sw_vals[i]} DIFF"
          node_match = false
        end
      end
      node_match ? matches += 1 : mismatches += 1
    elsif iw then iw_only += 1
    elsif sw then sw_only += 1
    end
  end

  puts ""
  puts "Matching: \#{matches}  Differences: \#{mismatches}  IW-only: \#{iw_only}  SW-only: \#{sw_only}"
  if mismatches == 0 && iw_only == 0 && sw_only == 0
    puts "PERFECT MATCH"
  elsif mismatches > 0
    puts "DIFFERENCES FOUND — check rounding, multi-subcatchment nodes, or manual edits"
  end
else
  puts "Need both InfoWorks and SWMM data in the same network to compare."
end

puts "Comparison complete."`,
  },
  {
    id: "script6",
    title: "Script 6: Import Calibrated RTK Back to ICM",
    description: "Read calibrated RTK parameters from CSV and write them back to ICM network objects. Works for both InfoWorks and SWMM networks.",
    code: `# ============================================================================
# SCRIPT 6: Import RTK Parameters into ICM Network
# Purpose:  Read RTK parameters from CSV and write them to network objects
#           Works for both InfoWorks and SWMM networks
# Usage:    Prepare a CSV with calibrated RTK values, then run
# ============================================================================

net = WSApplication.current_network

# ---------------------------------------------------------------------------
# Configuration — set your input CSV path
# ---------------------------------------------------------------------------
INPUT_CSV = 'C:/SSOAP/exports/calibrated_rtk_params.csv'

# Expected CSV format:
# For InfoWorks: Subcatchment_ID,R1,T1,K1,R2,T2,K2,R3,T3,K3
# For SWMM:     Node_ID,UH_Group,Sewer_Area,R1,T1,K1,R2,T2,K2,R3,T3,K3

puts "=" * 80
puts "RTK PARAMETER IMPORT"
puts "=" * 80
puts "Input: \#{INPUT_CSV}"

unless File.exist?(INPUT_CSV)
  puts "ERROR: File not found: \#{INPUT_CSV}"
  puts "Export calibrated RTK from SSOAP Toolbox first."
  exit
end

lines = File.readlines(INPUT_CSV).map(&:strip).reject(&:empty?)
header = lines[0].split(',').map(&:strip)
data_rows = lines[1..-1].map { |l| l.split(',').map(&:strip) }

puts "Columns: \#{header.join(', ')}"
puts "Rows: \#{data_rows.length}"

def col_index(header, *possible_names)
  possible_names.each do |name|
    idx = header.index { |h| h.downcase == name.downcase }
    return idx if idx
  end
  nil
end

id_col   = col_index(header, 'Subcatchment_ID', 'Node_ID', 'ID', 'Name')
r1_col   = col_index(header, 'R1')
t1_col   = col_index(header, 'T1', 'T1_hr')
k1_col   = col_index(header, 'K1')
r2_col   = col_index(header, 'R2')
t2_col   = col_index(header, 'T2', 'T2_hr')
k2_col   = col_index(header, 'K2')
r3_col   = col_index(header, 'R3')
t3_col   = col_index(header, 'T3', 'T3_hr')
k3_col   = col_index(header, 'K3')
uh_col   = col_index(header, 'UH_Group', 'RTK_Group')
area_col = col_index(header, 'Sewer_Area', 'Contributing_Area', 'Area')

unless id_col && r1_col
  puts "ERROR: CSV must have ID column and R1 column at minimum"
  exit
end

def try_write(obj, field_name, value)
  begin; obj[field_name] = value; return true; rescue; return false; end
end

# Find target table
target_table = nil
['hw_subcatchment', 'subcatchment', 'sw_node', 'sw_junction'].each do |tbl|
  begin
    objs = net.row_objects(tbl)
    if objs && objs.length > 0
      target_table = tbl
      break
    end
  rescue; end
end

unless target_table
  puts "ERROR: No suitable table found"
  exit
end

puts "Target: \#{target_table}"

objects_by_id = {}
net.row_objects(target_table).each { |obj| objects_by_id[obj.id.to_s] = obj }

updated = 0; not_found = 0; errors = 0
net.transaction_begin

data_rows.each do |row|
  obj_id = row[id_col]
  obj = objects_by_id[obj_id]
  unless obj
    puts "  WARNING: '\#{obj_id}' not found"
    not_found += 1
    next
  end

  begin
    r1 = row[r1_col].to_f if r1_col
    t1 = row[t1_col].to_f if t1_col
    k1 = row[k1_col].to_f if k1_col
    r2 = row[r2_col].to_f if r2_col
    t2 = row[t2_col].to_f if t2_col
    k2 = row[k2_col].to_f if k2_col
    r3 = row[r3_col].to_f if r3_col
    t3 = row[t3_col].to_f if t3_col
    k3 = row[k3_col].to_f if k3_col

    ['r1','rtk_r1','r_short'].each { |f| try_write(obj, f, r1) } if r1_col
    ['t1','rtk_t1','t_short'].each { |f| try_write(obj, f, t1) } if t1_col
    ['k1','rtk_k1','k_short'].each { |f| try_write(obj, f, k1) } if k1_col
    ['r2','rtk_r2','r_medium'].each { |f| try_write(obj, f, r2) } if r2_col
    ['t2','rtk_t2','t_medium'].each { |f| try_write(obj, f, t2) } if t2_col
    ['k2','rtk_k2','k_medium'].each { |f| try_write(obj, f, k2) } if k2_col
    ['r3','rtk_r3','r_long'].each { |f| try_write(obj, f, r3) } if r3_col
    ['t3','rtk_t3','t_long'].each { |f| try_write(obj, f, t3) } if t3_col
    ['k3','rtk_k3','k_long'].each { |f| try_write(obj, f, k3) } if k3_col

    if uh_col && row[uh_col]
      ['rtk_hydrograph','unit_hydrograph','uh_group'].each { |f| try_write(obj, f, row[uh_col]) }
    end
    if area_col && row[area_col]
      ['contributing_area','sewer_area'].each { |f| try_write(obj, f, row[area_col].to_f) }
    end

    obj.write
    r_total = (r1 || 0) + (r2 || 0) + (r3 || 0)
    puts "  Updated \#{obj_id}: R_total=%.4f" % r_total
    updated += 1
  rescue => e
    puts "  ERROR \#{obj_id}: \#{e.message}"
    errors += 1
  end
end

net.transaction_commit

puts ""
puts "Updated: \#{updated}  Not found: \#{not_found}  Errors: \#{errors}"
if errors == 0 && not_found == 0
  puts "All parameters imported successfully"
end`,
  },
];

export const ICM_WORKFLOW_GUIDE = `Typical workflow:
1. Run Script 1 to discover field names in your ICM version
2. Run Script 2 or 3 to extract current RTK → CSV
3. Import data into SSOAP Toolbox and calibrate
4. Run Script 4 for JSON export to SSOAP Toolbox
5. Run Script 6 to write calibrated parameters back to ICM
6. Run Script 5 to verify IW↔SWMM consistency after conversion`;
